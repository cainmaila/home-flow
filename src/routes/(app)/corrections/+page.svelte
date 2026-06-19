<script lang="ts">
	import { STANDARD_CATEGORIES } from '$lib/config/categories';

	const HOUSEHOLD_ID = 'default';

	let pending: { raw_category: string; count: number }[] = $state([]);
	let aiSuggestions: {
		id: string;
		raw_category: string;
		suggested_category: string;
		confidence: number;
	}[] = $state([]);
	let aliases: {
		id: string;
		raw_category: string;
		normalized_category: string;
		source: string;
		created_at: string;
	}[] = $state([]);

	let loading = $state(true);
	let errorMessage = $state('');
	let successMessage = $state('');

	let newAliasRaw = $state('');
	let newAliasNormalized = $state('');

	async function loadData() {
		loading = true;
		errorMessage = '';
		try {
			const [pendingRes, aliasRes, aiRes] = await Promise.all([
				fetch(`/api/categories/pending?householdId=${HOUSEHOLD_ID}`),
				fetch(`/api/categories/alias?householdId=${HOUSEHOLD_ID}`),
				fetch('/api/ai/suggestions?status=pending')
			]);

			if (!pendingRes.ok || !aliasRes.ok || !aiRes.ok) {
				errorMessage = '載入失敗';
				return;
			}

			pending = await pendingRes.json();
			aliases = await aliasRes.json();
			aiSuggestions = ((await aiRes.json()) as { suggestions: typeof aiSuggestions }).suggestions;
		} catch {
			errorMessage = '網路錯誤';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadData();
	});

	async function createAlias(rawCategory: string, normalizedCategory: string) {
		if (!normalizedCategory) return;

		errorMessage = '';
		successMessage = '';

		try {
			const res = await fetch('/api/categories/alias', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					householdId: HOUSEHOLD_ID,
					rawCategory: rawCategory,
					normalizedCategory: normalizedCategory
				})
			});

			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
				errorMessage = String(body?.message ?? '建立映射失敗');
				return;
			}

			successMessage = `已將「${rawCategory}」映射到「${normalizedCategory}」`;
			newAliasRaw = '';
			newAliasNormalized = '';
			await loadData();
		} catch {
			errorMessage = '網路錯誤';
		}
	}

	function handlePendingMap(rawCategory: string) {
		newAliasRaw = rawCategory;
		newAliasNormalized = '';
	}

	async function resolveSuggestion(suggestionId: string, action: 'accept' | 'reject') {
		errorMessage = '';
		successMessage = '';
		try {
			const res = await fetch('/api/ai/suggestions/resolve', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ suggestionId, action })
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
				errorMessage = String(body?.message ?? '處理建議失敗');
				return;
			}
			successMessage = action === 'accept' ? '已採納 AI 建議' : '已忽略 AI 建議';
			await loadData();
		} catch {
			errorMessage = '網路錯誤';
		}
	}
</script>

<div class="space-y-6">
	<h1 class="text-2xl font-bold">分類校正</h1>

	{#if loading}
		<div class="flex justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if errorMessage}
		<div class="alert alert-error">{errorMessage}</div>
	{:else}
		{#if successMessage}
			<div class="alert alert-success text-sm">{successMessage}</div>
		{/if}

		<!-- Pending categories -->
		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title text-lg">待確認分類 ({pending.length})</h2>
				{#if pending.length === 0}
					<p class="text-base-content/50">所有分類皆已映射。</p>
				{:else}
					<div class="overflow-x-auto">
						<table class="table table-sm">
							<thead>
								<tr>
									<th>原始分類</th>
									<th class="text-right">筆數</th>
									<th>操作</th>
								</tr>
							</thead>
							<tbody>
								{#each pending as item}
									<tr class="hover">
										<td>{item.raw_category}</td>
										<td class="text-right tabular-nums">{item.count}</td>
										<td>
											<button class="btn btn-primary btn-xs" onclick={() => handlePendingMap(item.raw_category)}>
												建立映射
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>

		<!-- AI suggestions pending review -->
		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title text-lg">AI 建議（待確認）({aiSuggestions.length})</h2>
				{#if aiSuggestions.length === 0}
					<p class="text-base-content/50">目前無待確認的 AI 建議。</p>
				{:else}
					<div class="overflow-x-auto">
						<table class="table table-sm">
							<thead>
								<tr>
									<th>原始分類</th>
									<th>建議標準分類</th>
									<th class="text-right">信心</th>
									<th>操作</th>
								</tr>
							</thead>
							<tbody>
								{#each aiSuggestions as s}
									<tr class="hover">
										<td>{s.raw_category}</td>
										<td>{s.suggested_category}</td>
										<td class="text-right tabular-nums">{Math.round(s.confidence * 100)}%</td>
										<td class="flex gap-2">
											<button class="btn btn-success btn-xs" onclick={() => resolveSuggestion(s.id, 'accept')}>
												採納
											</button>
											<button class="btn btn-ghost btn-xs" onclick={() => resolveSuggestion(s.id, 'reject')}>
												忽略
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>

		<!-- New alias form -->
		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title text-lg">新增分類映射</h2>
				<div class="flex flex-wrap gap-4 items-end">
					<label class="form-control w-full max-w-xs">
						<div class="label"><span class="label-text font-semibold">原始分類</span></div>
						<input type="text" class="input input-bordered input-sm" bind:value={newAliasRaw} placeholder="例: 消夜/零食" />
					</label>
					<label class="form-control w-full max-w-xs">
						<div class="label"><span class="label-text font-semibold">標準分類</span></div>
						<select class="select select-bordered select-sm" bind:value={newAliasNormalized}>
							<option value="">-- 選擇 --</option>
							{#each STANDARD_CATEGORIES as cat}
								<option value={cat}>{cat}</option>
							{/each}
						</select>
					</label>
					<button
						class="btn btn-primary btn-sm"
						onclick={() => createAlias(newAliasRaw, newAliasNormalized)}
						disabled={!newAliasRaw || !newAliasNormalized}
					>
						確認
					</button>
				</div>
			</div>
		</div>

		<!-- Existing aliases -->
		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title text-lg">現有映射 ({aliases.length})</h2>
				{#if aliases.length === 0}
					<p class="text-base-content/50">尚無映射規則。</p>
				{:else}
					<div class="overflow-x-auto">
						<table class="table table-sm">
							<thead>
								<tr>
									<th>原始分類</th>
									<th>標準分類</th>
									<th>來源</th>
									<th>建立時間</th>
								</tr>
							</thead>
							<tbody>
								{#each aliases as alias}
									<tr class="hover">
										<td>{alias.raw_category}</td>
										<td>{alias.normalized_category}</td>
										<td>
											<span class="badge badge-sm {alias.source === 'manual' ? 'badge-primary' : 'badge-ghost'}">
												{alias.source === 'manual' ? '人工' : 'AI 自動'}
											</span>
										</td>
										<td class="whitespace-nowrap">{alias.created_at}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
