<script lang="ts">
	import { STANDARD_CATEGORIES } from '$lib/config/categories';

	const HOUSEHOLD_ID = 'default';

	// Pending (unresolved) categories
	let pending: { raw_category: string; count: number }[] = $state([]);
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

	// New alias form
	let newAliasRaw = $state('');
	let newAliasNormalized = $state('');

	async function loadData() {
		loading = true;
		errorMessage = '';
		try {
			const [pendingRes, aliasRes] = await Promise.all([
				fetch(`/api/categories/pending?householdId=${HOUSEHOLD_ID}`),
				fetch(`/api/categories/alias?householdId=${HOUSEHOLD_ID}`)
			]);

			if (!pendingRes.ok || !aliasRes.ok) {
				errorMessage = '載入失敗';
				return;
			}

			pending = await pendingRes.json();
			aliases = await aliasRes.json();
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
</script>

<div class="corrections-page">
	<h1>分類校正</h1>

	{#if loading}
		<p>載入中...</p>
	{:else if errorMessage}
		<p class="error">{errorMessage}</p>
	{:else}
		{#if successMessage}
			<p class="success">{successMessage}</p>
		{/if}

		<!-- Pending categories section -->
		<section>
			<h2>待確認分類 ({pending.length})</h2>
			{#if pending.length === 0}
				<p>所有分類皆已映射。</p>
			{:else}
				<div class="table-scroll">
					<table>
						<thead>
							<tr>
								<th>原始分類</th>
								<th>筆數</th>
								<th>操作</th>
							</tr>
						</thead>
						<tbody>
							{#each pending as item}
								<tr>
									<td>{item.raw_category}</td>
									<td>{item.count}</td>
									<td>
										<button onclick={() => handlePendingMap(item.raw_category)}>
											建立映射
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>

		<!-- New alias form -->
		<section class="alias-form">
			<h2>新增分類映射</h2>
			<div class="form-row">
				<label>
					原始分類
					<input type="text" bind:value={newAliasRaw} placeholder="例: 消夜/零食" />
				</label>
				<label>
					標準分類
					<select bind:value={newAliasNormalized}>
						<option value="">-- 選擇 --</option>
						{#each STANDARD_CATEGORIES as cat}
							<option value={cat}>{cat}</option>
						{/each}
					</select>
				</label>
				<button
					onclick={() => createAlias(newAliasRaw, newAliasNormalized)}
					disabled={!newAliasRaw || !newAliasNormalized}
				>
					確認
				</button>
			</div>
		</section>

		<!-- Existing aliases section -->
		<section>
			<h2>現有映射 ({aliases.length})</h2>
			{#if aliases.length === 0}
				<p>尚無映射規則。</p>
			{:else}
				<div class="table-scroll">
					<table>
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
								<tr>
									<td>{alias.raw_category}</td>
									<td>{alias.normalized_category}</td>
									<td>{alias.source === 'manual' ? '人工' : 'AI 自動'}</td>
									<td>{alias.created_at}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	{/if}

</div>

<style>
	.corrections-page {
		max-width: 800px;
		margin: 0 auto;
		font-family: system-ui, sans-serif;
	}

	section {
		margin-bottom: 2rem;
	}

	.error {
		color: #c00;
	}

	.success {
		color: #080;
		background: #e8f5e9;
		padding: 0.5rem 1rem;
		border-radius: 4px;
	}

	.table-scroll {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 0.5rem;
	}

	th,
	td {
		border: 1px solid #ddd;
		padding: 0.4rem 0.6rem;
		text-align: left;
		white-space: nowrap;
	}

	th {
		background: #f5f5f5;
		font-size: 0.85rem;
	}

	.alias-form {
		background: #f9f9f9;
		padding: 1rem;
		border-radius: 6px;
	}

	.form-row {
		display: flex;
		gap: 1rem;
		align-items: flex-end;
		flex-wrap: wrap;
	}

	.form-row label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-weight: 600;
		font-size: 0.9rem;
		min-width: 0;
	}

	.form-row input,
	.form-row select {
		padding: 0.3rem 0.5rem;
		font-size: 0.9rem;
		max-width: 100%;
	}

	button {
		padding: 0.4rem 1rem;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@media (max-width: 640px) {
		.form-row {
			flex-direction: column;
			align-items: stretch;
		}

		.form-row label {
			width: 100%;
		}

		.form-row input,
		.form-row select {
			width: 100%;
		}
	}
</style>
