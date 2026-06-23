<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Chart, type ActiveElement, type ChartEvent } from 'chart.js/auto';
	import Icon from '@iconify/svelte';
	import { icons } from '$lib/icons';
	import { formatAmount } from '$lib/utils';
	import Tag from '$lib/components/Tag.svelte';
	import { tagColor } from '$lib/tagColor';
	import MatrixTable from './MatrixTable.svelte';

	// --- State ---
	let loading = $state(true);
	let errorMessage = $state('');

	// Monthly report data
	let selectedMonth = $state('');
	let availableMonths: string[] = $state([]);
	let totalExpense = $state(0);
	let categoryBreakdown: { category: string; parent_category: string; category_id: number | null; parent_id: number | null; total: number; percentage: number }[] = $state([]);
	let paymentBreakdown: { method: string; total: number; percentage: number }[] = $state([]);

	// Matrix data
	let matrixMonths: string[] = $state([]);
	let matrixRows: { big_category: string; totals: Record<string, number>; avg: number; vsAvg: number }[] = $state([]);

	// Trend data
	let trendMonths: { month: string; total: number }[] = $state([]);
	let comparison: {
		currentMonth: string;
		previousMonth: string;
		currentTotal: number;
		previousTotal: number;
		diff: number;
		diffPercent: number;
	} | null = $state(null);

	// Chart instances
	let doughnutCanvas: HTMLCanvasElement | undefined = $state();
	let barCanvas: HTMLCanvasElement | undefined = $state();
	let doughnutChart: Chart | null = null;
	let barChart: Chart | null = null;

	// T4.5: Chart click filter state
	let selectedCategory = $state('');
	let filteredExpenses: {
		id: string;
		expense_date: string;
		raw_category: string;
		normalized_category: string;
		amount: number;
		detail?: string | null;
		tags?: string[];
	}[] = $state([]);
	let filteredTotal = $state(0);
	let filteredCount = $state(0);
	let filterLoading = $state(false);

	// Category palette — muted, harmonized with the emerald brand theme
	const COLORS = [
		'#2f9e74', '#5b7aa8', '#d9a441', '#d56b6b', '#4fa3a0',
		'#8b7bb0', '#7fa86a', '#c08552', '#6fa8c7', '#b07a99',
		'#3f8f8a', '#9ca84f', '#cf8f5a', '#6b8fd5', '#a86a7f'
	];


	async function loadMonthlyReport(month?: string) {
		errorMessage = '';
		const params = month ? `?month=${month}` : '';
		try {
			const res = await fetch(`/api/reports/monthly${params}`);
			if (!res.ok) {
				errorMessage = '載入月報失敗';
				return;
			}
			const data = (await res.json()) as {
				month: string | null;
				totalExpense: number;
				categoryBreakdown: typeof categoryBreakdown;
				paymentBreakdown: typeof paymentBreakdown;
				availableMonths: string[];
			};
			selectedMonth = data.month ?? '';
			totalExpense = data.totalExpense;
			categoryBreakdown = data.categoryBreakdown;
			paymentBreakdown = data.paymentBreakdown ?? [];
			availableMonths = data.availableMonths;
		} catch {
			errorMessage = '網路錯誤';
		}
	}

	// ponytail: ANOMALY_THRESHOLD=0.3, MATRIX_MONTHS=6 — tune if needed
	const ANOMALY_THRESHOLD = 0.3;
	const MATRIX_MONTHS = 6;

	async function loadMatrix() {
		try {
			const res = await fetch(`/api/reports/matrix?months=${MATRIX_MONTHS}`);
			if (!res.ok) return;
			const { months, data } = (await res.json()) as {
				months: string[];
				data: { month: string; big_category: string; total: number }[];
			};
			matrixMonths = months;

			const byCategory = new Map<string, Record<string, number>>();
			for (const d of data) {
				if (!byCategory.has(d.big_category)) byCategory.set(d.big_category, {});
				byCategory.get(d.big_category)![d.month] = d.total;
			}

			const latestMonth = months[months.length - 1];
			matrixRows = [...byCategory.entries()]
				.map(([big_category, totals]) => {
					const vals = months.map((m) => totals[m] ?? 0);
					const sum = vals.reduce((a, b) => a + b, 0);
					const avg = months.length > 0 ? Math.round(sum / months.length) : 0;
					const latest = totals[latestMonth] ?? 0;
					const vsAvg = avg > 0 ? (latest - avg) / avg : 0;
					return { big_category, totals, avg, vsAvg };
				})
				.sort((a, b) => (b.totals[latestMonth] ?? 0) - (a.totals[latestMonth] ?? 0));
		} catch {
			// supplementary
		}
	}

	async function loadTrend() {
		try {
			const res = await fetch('/api/reports/trend');
			if (!res.ok) return;
			const data = (await res.json()) as {
				months: typeof trendMonths;
				comparison: typeof comparison;
			};
			trendMonths = data.months;
			comparison = data.comparison;
		} catch {
			// Trend is supplementary; don't block on error
		}
	}

	async function loadFilteredExpenses(category: string, categoryId?: number | null) {
		filterLoading = true;
		const params = new URLSearchParams();
		params.set('month', selectedMonth);
		if (categoryId) params.set('categoryId', String(categoryId));
		else params.set('category', category);
		try {
			const res = await fetch(`/api/expenses/search?${params}`);
			if (!res.ok) return;
			const data = (await res.json()) as {
				expenses: typeof filteredExpenses;
				total: number;
				count: number;
			};
			filteredExpenses = data.expenses;
			filteredTotal = data.total;
			filteredCount = data.count;
		} catch {
			// Non-blocking
		} finally {
			filterLoading = false;
		}
	}

	function clearCategoryFilter() {
		selectedCategory = '';
		filteredExpenses = [];
		filteredTotal = 0;
		filteredCount = 0;
		renderDoughnutChart();
	}

	async function selectCategory(category: string, categoryId?: number | null) {
		if (selectedCategory === category) {
			clearCategoryFilter();
			return;
		}
		selectedCategory = category;
		await loadFilteredExpenses(category, categoryId);
		renderDoughnutChart();
	}

	async function handleMonthChange(event: Event) {
		const value = (event.target as HTMLSelectElement).value;
		if (value && value !== selectedMonth) {
			selectedCategory = '';
			filteredExpenses = [];
			await loadMonthlyReport(value);
			renderDoughnutChart();
		}
	}

	async function handleBarClick(_event: ChartEvent, elements: ActiveElement[]) {
		if (elements.length === 0) return;
		const index = elements[0].index;
		const clickedMonth = trendMonths[index]?.month;
		if (!clickedMonth || clickedMonth === selectedMonth) return;
		selectedCategory = '';
		filteredExpenses = [];
		await loadMonthlyReport(clickedMonth);
		renderDoughnutChart();
	}

	function renderDoughnutChart() {
		if (!doughnutCanvas) return;
		if (doughnutChart) doughnutChart.destroy();
		if (categoryBreakdown.length === 0) return;

		const bgColors = COLORS.slice(0, categoryBreakdown.length).map((color, i) => {
			if (selectedCategory && categoryBreakdown[i].category !== selectedCategory) {
				return color + '40';
			}
			return color;
		});

		doughnutChart = new Chart(doughnutCanvas, {
			type: 'doughnut',
			data: {
				labels: categoryBreakdown.map((c) => c.parent_category !== '未分類' ? `${c.parent_category} > ${c.category}` : c.category),
				datasets: [{
					data: categoryBreakdown.map((c) => c.total),
					backgroundColor: bgColors,
					borderWidth: categoryBreakdown.map((c) =>
						selectedCategory === c.category ? 3 : 1
					)
				}]
			},
			options: {
				responsive: true,
				onClick(_event: ChartEvent, elements: ActiveElement[]) {
					if (elements.length === 0) return;
					const index = elements[0].index;
					const category = categoryBreakdown[index]?.category;
					if (category) selectCategory(category, categoryBreakdown[index]?.category_id);
				},
				plugins: {
					legend: { position: 'bottom' },
					tooltip: {
						callbacks: {
							label(ctx) {
								const item = categoryBreakdown[ctx.dataIndex];
								return `${item.category}: ${formatAmount(item.total)} (${item.percentage}%)`;
							}
						}
					}
				}
			}
		});
	}

	function renderBarChart() {
		if (!barCanvas) return;
		if (barChart) barChart.destroy();
		if (trendMonths.length === 0) return;

		barChart = new Chart(barCanvas, {
			type: 'bar',
			data: {
				labels: trendMonths.map((m) => m.month),
				datasets: [{
					label: '月支出',
					data: trendMonths.map((m) => m.total),
					backgroundColor: trendMonths.map((m) =>
						m.month === selectedMonth ? '#2f9e74' : '#b7d4c8'
					)
				}]
			},
			options: {
				responsive: true,
				onClick: handleBarClick,
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label(ctx) {
								return `${formatAmount(ctx.raw as number)}`;
							}
						}
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						ticks: {
							callback(value) {
								return formatAmount(value as number);
							}
						}
					}
				}
			}
		});
	}

	onMount(async () => {
		await Promise.all([loadMonthlyReport(), loadTrend(), loadMatrix()]);
		loading = false;

		await tick();
		renderDoughnutChart();
		renderBarChart();
	});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between flex-wrap gap-4">
		<h1 class="text-2xl font-bold">月報表</h1>

		{#if !loading && availableMonths.length > 0}
			<select class="select select-bordered select-sm" value={selectedMonth} onchange={handleMonthChange}>
				{#each availableMonths as m}
					<option value={m}>{m}</option>
				{/each}
			</select>
		{/if}
	</div>

	{#if loading}
		<div class="flex justify-center items-center gap-3 py-12 text-base-content/60">
			<span class="loading loading-spinner loading-lg"></span> 載入中…
		</div>
	{:else if errorMessage}
		<div class="alert alert-error">{errorMessage}</div>
	{:else if availableMonths.length === 0}
		<div class="card bg-base-100 shadow">
			<div class="card-body text-center">
				<p>尚無支出資料。請先<a href="/import" class="link link-primary">匯入 CSV</a>。</p>
			</div>
		</div>
	{:else}
		<!-- Stat card — signature element -->
		<div class="stats shadow bg-base-100 w-full">
			<div class="stat">
				<div class="stat-title">{selectedMonth} 總支出</div>
				<div class="stat-value text-primary tabular-nums">{formatAmount(totalExpense)}</div>
				{#if comparison && selectedMonth === comparison.currentMonth}
					<div class="stat-desc text-base">
						vs 上月
						<span class={comparison.diff >= 0 ? 'text-error font-semibold' : 'text-success font-semibold'}>
							{comparison.diff >= 0 ? '+' : ''}{formatAmount(comparison.diff)}
							({comparison.diff >= 0 ? '+' : ''}{comparison.diffPercent}%)
						</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Filter chip -->
		{#if selectedCategory}
			<div class="flex items-center gap-2">
				<div class="badge badge-primary badge-lg gap-2">
					篩選: {selectedCategory}
					<button class="cursor-pointer" aria-label="清除篩選" onclick={clearCategoryFilter}><Icon icon={icons.close} class="text-sm" /></button>
				</div>
			</div>
		{/if}

		<!-- Charts -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			{#if categoryBreakdown.length > 0}
				<div class="card bg-base-100 shadow">
					<div class="card-body">
						<h2 class="card-title text-lg">分類占比</h2>
						<div class="max-w-xs mx-auto">
							<canvas bind:this={doughnutCanvas}></canvas>
						</div>
					</div>
				</div>
			{/if}

			{#if trendMonths.length > 0}
				<div class="card bg-base-100 shadow">
					<div class="card-body">
						<h2 class="card-title text-lg">月趨勢</h2>
						<canvas bind:this={barCanvas}></canvas>
					</div>
				</div>
			{/if}
		</div>

		<MatrixTable {matrixMonths} {matrixRows} anomalyThreshold={ANOMALY_THRESHOLD} />

		<!-- Category ranking -->
		{#if categoryBreakdown.length > 0}
			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<h2 class="card-title text-lg">分類排行</h2>
					<div class="overflow-x-auto">
						<table class="table table-sm">
							<thead>
								<tr>
									<th>#</th>
									<th>分類</th>
									<th class="text-right">金額</th>
									<th class="text-right">占比</th>
								</tr>
							</thead>
							<tbody>
								{#each categoryBreakdown as cat, i}
									<tr class={selectedCategory === cat.category ? 'bg-primary/10' : 'hover'}>
										<td>{i + 1}</td>
										<td>
											<button class="link link-primary" onclick={() => selectCategory(cat.category, cat.category_id)}>
												{cat.parent_category !== '未分類' ? `${cat.parent_category} > ` : ''}{cat.category}
											</button>
										</td>
										<td class="text-right tabular-nums">{formatAmount(cat.total)}</td>
										<td class="text-right">{cat.percentage}%</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		{/if}

		<!-- Payment method breakdown -->
		{#if paymentBreakdown.length > 0}
			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<h2 class="card-title text-lg">各付款方式</h2>
					<div class="overflow-x-auto">
						<table class="table table-sm">
							<thead>
								<tr>
									<th>#</th>
									<th>付款方式</th>
									<th class="text-right">金額</th>
									<th class="text-right">占比</th>
								</tr>
							</thead>
							<tbody>
								{#each paymentBreakdown as pm, i}
									<tr class="hover">
										<td>{i + 1}</td>
										<td>{pm.method}</td>
										<td class="text-right tabular-nums">{formatAmount(pm.total)}</td>
										<td class="text-right">{pm.percentage}%</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		{/if}

		<!-- Filtered detail -->
		{#if selectedCategory}
			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<h2 class="card-title text-lg">{selectedCategory} 明細</h2>
					{#if filterLoading}
						<div class="flex justify-center py-4">
							<span class="loading loading-spinner"></span>
						</div>
					{:else if filteredExpenses.length > 0}
						<p class="text-sm text-base-content/70">
							共 {filteredCount} 筆，合計 <strong class="tabular-nums">{formatAmount(filteredTotal)}</strong>
						</p>
						<div class="overflow-x-auto">
							<table class="table table-sm">
								<thead>
									<tr>
										<th>日期</th>
										<th>分類</th>
										<th>明細</th>
										<th class="text-right">金額</th>
										<th>標籤</th>
									</tr>
								</thead>
								<tbody>
									{#each filteredExpenses as exp}
										<tr class="hover">
											<td>{exp.expense_date}</td>
											<td>{exp.normalized_category}</td>
											<td class="text-sm text-base-content/70">{exp.detail ?? ''}</td>
											<td class="text-right tabular-nums">{formatAmount(exp.amount)}</td>
											<td class="space-x-1">{#each exp.tags ?? [] as tag}<Tag label={tag} color={tagColor(tag)} variant="outline" size="sm" />{/each}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}
						<p class="text-base-content/50">無符合條件的資料。</p>
					{/if}
				</div>
			</div>
		{/if}

		<div class="text-sm">
			<a href="/reports/details?month={selectedMonth}" class="link link-primary">查看完整明細</a>
		</div>
	{/if}
</div>
