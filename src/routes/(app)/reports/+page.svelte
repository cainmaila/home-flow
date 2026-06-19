<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Chart, type ActiveElement, type ChartEvent } from 'chart.js/auto';

	// --- State ---
	let loading = $state(true);
	let errorMessage = $state('');

	// Monthly report data
	let selectedMonth = $state('');
	let availableMonths: string[] = $state([]);
	let totalExpense = $state(0);
	let categoryBreakdown: { category: string; total: number; percentage: number }[] = $state([]);

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
		is_fixed_expense: boolean;
	}[] = $state([]);
	let filteredTotal = $state(0);
	let filteredCount = $state(0);
	let filterLoading = $state(false);

	// Colors for categories
	const COLORS = [
		'#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
		'#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
		'#86bcb6', '#8cd17d', '#b6992d', '#499894', '#e15759'
	];

	function formatAmount(cents: number): string {
		return Math.round(cents).toLocaleString('zh-TW');
	}

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
				categoryBreakdown: { category: string; total: number; percentage: number }[];
				availableMonths: string[];
			};
			selectedMonth = data.month ?? '';
			totalExpense = data.totalExpense;
			categoryBreakdown = data.categoryBreakdown;
			availableMonths = data.availableMonths;
		} catch {
			errorMessage = '網路錯誤';
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

	// T4.5: Load filtered expenses by category
	async function loadFilteredExpenses(category: string) {
		filterLoading = true;
		const params = new URLSearchParams();
		params.set('month', selectedMonth);
		params.set('category', category);
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

	async function selectCategory(category: string) {
		if (selectedCategory === category) {
			clearCategoryFilter();
			return;
		}
		selectedCategory = category;
		await loadFilteredExpenses(category);
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

	// T4.5: Handle bar chart click to switch month
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
				return color + '40'; // Dim unselected segments
			}
			return color;
		});

		doughnutChart = new Chart(doughnutCanvas, {
			type: 'doughnut',
			data: {
				labels: categoryBreakdown.map((c) => c.category),
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
					if (category) selectCategory(category);
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
						m.month === selectedMonth ? '#2b5c8a' : '#4e79a7'
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
		await Promise.all([loadMonthlyReport(), loadTrend()]);
		loading = false;

		await tick();
		renderDoughnutChart();
		renderBarChart();
	});
</script>

<div class="reports-page">
	<h1>月報表</h1>

	{#if loading}
		<p>載入中...</p>
	{:else if errorMessage}
		<p class="error">{errorMessage}</p>
	{:else if availableMonths.length === 0}
		<p>尚無支出資料。請先<a href="/import">匯入 CSV</a>。</p>
	{:else}
		<!-- Month selector -->
		<div class="month-selector">
			<label for="month-select">月份</label>
			<select id="month-select" value={selectedMonth} onchange={handleMonthChange}>
				{#each availableMonths as m}
					<option value={m}>{m}</option>
				{/each}
			</select>
		</div>

		<!-- Total expense -->
		<div class="total-card">
			<span class="total-label">{selectedMonth} 總支出</span>
			<span class="total-amount">{formatAmount(totalExpense)}</span>
		</div>

		<!-- Month comparison (T4.3) -->
		{#if comparison && selectedMonth === comparison.currentMonth}
			<div class="comparison-card">
				vs 上月
				<span class={comparison.diff >= 0 ? 'diff-up' : 'diff-down'}>
					{comparison.diff >= 0 ? '+' : ''}{formatAmount(comparison.diff)}
					({comparison.diff >= 0 ? '+' : ''}{comparison.diffPercent}%)
				</span>
			</div>
		{/if}

		<!-- Active filter chip (T4.5) -->
		{#if selectedCategory}
			<div class="filter-chip">
				<span>正在篩選: {selectedCategory}</span>
				<button class="chip-clear" onclick={clearCategoryFilter}>&times;</button>
			</div>
		{/if}

		<!-- Category ranking table (T4.2) -->
		<section>
			<h2>分類排行</h2>
			{#if categoryBreakdown.length > 0}
				<table>
					<thead>
						<tr>
							<th>#</th>
							<th>分類</th>
							<th>金額</th>
							<th>占比</th>
						</tr>
					</thead>
					<tbody>
						{#each categoryBreakdown as cat, i}
							<tr class:selected-row={selectedCategory === cat.category}>
								<td>{i + 1}</td>
								<td>
									<button class="category-btn" onclick={() => selectCategory(cat.category)}>
										{cat.category}
									</button>
								</td>
								<td class="amount">{formatAmount(cat.total)}</td>
								<td>{cat.percentage}%</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{:else}
				<p>此月份無資料。</p>
			{/if}
		</section>

		<!-- Doughnut chart (T4.2) -->
		{#if categoryBreakdown.length > 0}
			<section>
				<h2>分類占比</h2>
				<div class="chart-container">
					<canvas bind:this={doughnutCanvas}></canvas>
				</div>
			</section>
		{/if}

		<!-- Bar chart - monthly trend (T4.3) -->
		{#if trendMonths.length > 0}
			<section>
				<h2>月趨勢</h2>
				<div class="chart-container">
					<canvas bind:this={barCanvas}></canvas>
				</div>
			</section>
		{/if}

		<!-- T4.5: Inline filtered detail table -->
		{#if selectedCategory}
			<section>
				<h2>{selectedCategory} 明細</h2>
				{#if filterLoading}
					<p>載入中...</p>
				{:else if filteredExpenses.length > 0}
					<div class="summary">
						共 {filteredCount} 筆，合計 <strong>{formatAmount(filteredTotal)}</strong>
					</div>
					<div class="table-scroll">
						<table>
							<thead>
								<tr>
									<th>日期</th>
									<th>分類</th>
									<th>金額</th>
									<th>固定</th>
								</tr>
							</thead>
							<tbody>
								{#each filteredExpenses as exp}
									<tr>
										<td>{exp.expense_date}</td>
										<td>{exp.normalized_category}</td>
										<td class="amount">{formatAmount(exp.amount)}</td>
										<td>{exp.is_fixed_expense ? '是' : ''}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<p>無符合條件的資料。</p>
				{/if}
			</section>
		{/if}

		<p class="nav-link">
			<a href="/reports/details?month={selectedMonth}">查看完整明細</a>
		</p>
	{/if}
</div>

<style>
	.reports-page {
		max-width: 800px;
		margin: 0 auto;
		padding: 1rem;
		font-family: system-ui, sans-serif;
	}

	.month-selector {
		margin-bottom: 1rem;
	}

	.month-selector label {
		font-weight: 600;
		margin-right: 0.5rem;
	}

	.month-selector select {
		padding: 0.3rem 0.5rem;
		font-size: 1rem;
	}

	.total-card {
		display: flex;
		flex-direction: column;
		background: #f0f6ff;
		padding: 1.5rem;
		border-radius: 8px;
		margin-bottom: 1rem;
	}

	.total-label {
		font-size: 0.9rem;
		color: #555;
	}

	.total-amount {
		font-size: clamp(1.4rem, 5vw, 2rem);
		font-weight: 700;
		color: #1a1a1a;
	}

	.comparison-card {
		background: #fafafa;
		padding: 0.75rem 1rem;
		border-radius: 6px;
		margin-bottom: 1.5rem;
		font-size: 0.95rem;
	}

	.diff-up {
		color: #c00;
		font-weight: 600;
	}

	.diff-down {
		color: #080;
		font-weight: 600;
	}

	/* T4.5: Filter chip */
	.filter-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: #e3f0ff;
		border: 1px solid #a0c4e8;
		padding: 0.3rem 0.7rem;
		border-radius: 20px;
		font-size: 0.9rem;
		margin-bottom: 1rem;
	}

	.chip-clear {
		background: none;
		border: none;
		font-size: 1.1rem;
		cursor: pointer;
		padding: 0 0.2rem;
		line-height: 1;
		color: #555;
	}

	.chip-clear:hover {
		color: #c00;
	}

	/* T4.5: Category button in ranking table */
	.category-btn {
		background: none;
		border: none;
		color: #0066cc;
		cursor: pointer;
		padding: 0;
		font: inherit;
		text-align: left;
	}

	.category-btn:hover {
		text-decoration: underline;
	}

	tr.selected-row {
		background: #e3f0ff;
	}

	.summary {
		margin-bottom: 0.5rem;
		font-size: 0.95rem;
	}

	section {
		margin-bottom: 2rem;
	}

	.table-scroll {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 0.5rem;
	}

	th, td {
		border: 1px solid #ddd;
		padding: 0.4rem 0.6rem;
		text-align: left;
	}

	th {
		background: #f5f5f5;
		font-size: 0.85rem;
	}

	td.amount {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.chart-container {
		max-width: 500px;
		margin: 0 auto;
	}

	.error {
		color: #c00;
	}

	.nav-link {
		margin-top: 2rem;
		font-size: 0.9rem;
	}

	.nav-link a {
		color: #0066cc;
	}
</style>
