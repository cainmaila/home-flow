<script lang="ts">
	import Icon from '@iconify/svelte';
	import { icons } from '$lib/icons';
	const HOUSEHOLD_ID = 'default';

	interface CategoryChild {
		id: number;
		name: string;
		icon: string | null;
		color: string | null;
		sort_order: number;
	}

	interface CategoryParent {
		id: number;
		name: string;
		description: string | null;
		icon: string | null;
		color: string | null;
		sort_order: number;
		children: CategoryChild[];
	}

	let categories: CategoryParent[] = $state([]);
	let pending: { raw_category: string; count: number }[] = $state([]);
	let aiSuggestions: {
		id: string;
		raw_category: string;
		suggested_category: string;
		parent_name: string | null;
		confidence: number;
	}[] = $state([]);
	let aliases: {
		id: string;
		raw_category: string;
		normalized_category: string;
		category_id: number | null;
		source: string;
		created_at: string;
		category_name: string | null;
		parent_name: string | null;
	}[] = $state([]);

	let loading = $state(true);
	let errorMessage = $state('');
	let successMessage = $state('');
	let aiLoading = $state(false);
	let selectedSuggestions: Set<string> = $state(new Set());

	let aliasModalOpen = $state(false);
	let newAliasRaw = $state('');
	let newAliasParentId: number | null = $state(null);
	let newAliasCategoryId: number | null = $state(null);

	let selectedParent = $derived(categories.find((c) => c.id === newAliasParentId));
	let childOptions = $derived(selectedParent?.children ?? []);

	async function loadData() {
		loading = true;
		errorMessage = '';
		try {
			const [pendingRes, aliasRes, aiRes, catRes] = await Promise.all([
				fetch(`/api/categories/pending?householdId=${HOUSEHOLD_ID}`),
				fetch(`/api/categories/alias?householdId=${HOUSEHOLD_ID}`),
				fetch('/api/ai/suggestions?status=pending'),
				fetch(`/api/categories/manage?householdId=${HOUSEHOLD_ID}`)
			]);

			if (!pendingRes.ok || !aliasRes.ok || !aiRes.ok || !catRes.ok) {
				errorMessage = '載入失敗';
				return;
			}

			pending = await pendingRes.json();
			aliases = await aliasRes.json();
			aiSuggestions = ((await aiRes.json()) as { suggestions: typeof aiSuggestions }).suggestions;
			categories = await catRes.json();
		} catch {
			errorMessage = '網路錯誤';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadData();
	});

	async function createAlias(rawCategory: string, categoryId: number | null) {
		if (!categoryId) return;

		errorMessage = '';
		successMessage = '';

		try {
			const res = await fetch('/api/categories/alias', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					householdId: HOUSEHOLD_ID,
					rawCategory: rawCategory,
					categoryId: categoryId
				})
			});

			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
				errorMessage = String(body?.message ?? '建立映射失敗');
				return;
			}

			const cat = childOptions.find((c) => c.id === categoryId);
			successMessage = `已將「${rawCategory}」映射到「${selectedParent?.name} > ${cat?.name}」`;
			newAliasRaw = '';
			newAliasParentId = null;
			newAliasCategoryId = null;
			aliasModalOpen = false;
			await loadData();
		} catch {
			errorMessage = '網路錯誤';
		}
	}

	function handlePendingMap(rawCategory: string) {
		newAliasRaw = rawCategory;
		newAliasParentId = null;
		newAliasCategoryId = null;
		aliasModalOpen = true;
	}

	async function triggerAISuggestions() {
		aiLoading = true;
		errorMessage = '';
		successMessage = '';
		try {
			const res = await fetch('/api/ai/suggest', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ householdId: HOUSEHOLD_ID })
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
				errorMessage = String(body?.message ?? 'AI 建議產生失敗');
				return;
			}
			const data = (await res.json()) as { suggestions: unknown[] };
			if (data.suggestions.length === 0) {
				successMessage = '所有分類皆已有映射或建議，無需產生新建議。';
			} else {
				successMessage = `已產生 ${data.suggestions.length} 筆 AI 建議。`;
			}
			selectedSuggestions = new Set();
			await loadData();
		} catch {
			errorMessage = '網路錯誤';
		} finally {
			aiLoading = false;
		}
	}

	function toggleSelection(id: string) {
		const next = new Set(selectedSuggestions);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedSuggestions = next;
	}

	function toggleAll() {
		if (selectedSuggestions.size === aiSuggestions.length) {
			selectedSuggestions = new Set();
		} else {
			selectedSuggestions = new Set(aiSuggestions.map((s) => s.id));
		}
	}

	async function acceptSelected() {
		if (selectedSuggestions.size === 0) return;
		errorMessage = '';
		successMessage = '';
		const ids = [...selectedSuggestions];
		let accepted = 0;
		for (const id of ids) {
			try {
				await resolveSuggestion(id, 'accept', true);
				accepted++;
			} catch {
				break;
			}
		}
		if (accepted > 0) {
			successMessage = `已採納 ${accepted} 筆 AI 建議。`;
		}
		if (accepted < ids.length) {
			errorMessage = errorMessage || `部分建議採納失敗（${accepted}/${ids.length}）`;
		}
		selectedSuggestions = new Set();
		await loadData();
	}

	async function resolveSuggestion(suggestionId: string, action: 'accept' | 'reject', silent = false) {
		if (!silent) {
			errorMessage = '';
			successMessage = '';
		}
		const res = await fetch('/api/ai/suggestions/resolve', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ suggestionId, action })
		});
		if (!res.ok) {
			const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
			errorMessage = String(body?.message ?? '處理建議失敗');
			throw new Error(errorMessage);
		}
		if (!silent) {
			successMessage = action === 'accept' ? '已採納 AI 建議' : '已忽略 AI 建議';
			await loadData();
		}
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">分類校正</h1>
		<button class="btn btn-primary btn-sm gap-1" onclick={() => { newAliasRaw = ''; newAliasParentId = null; newAliasCategoryId = null; aliasModalOpen = true; }}>
			<Icon icon={icons.addCircle} class="text-base" />新增映射
		</button>
	</div>

	{#if loading}
		<div class="flex justify-center items-center gap-3 py-12 text-base-content/60">
			<span class="loading loading-spinner loading-lg"></span> 載入中…
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
									<th>明細</th>
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
											<button class="btn btn-primary btn-xs gap-0.5" onclick={() => handlePendingMap(item.raw_category)}>
												<Icon icon={icons.link} class="text-sm" />建立映射
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
				<div class="flex items-center justify-between">
					<h2 class="card-title text-lg">AI 建議（待確認）({aiSuggestions.length})</h2>
					<button
						class="btn btn-secondary btn-sm gap-1"
						onclick={triggerAISuggestions}
						disabled={aiLoading}
					>
						{#if aiLoading}
							<span class="loading loading-spinner loading-xs"></span>
						{:else}
							<Icon icon={icons.ai} class="text-base" />
						{/if}
						AI 一鍵建議
					</button>
				</div>
				{#if aiSuggestions.length === 0}
					<p class="text-base-content/50">目前無待確認的 AI 建議。點擊「AI 一鍵建議」為未匹配分類產生建議。</p>
				{:else}
					<div class="overflow-x-auto">
						<table class="table table-sm">
							<thead>
								<tr>
									<th>
										<input type="checkbox" class="checkbox checkbox-sm"
											checked={selectedSuggestions.size === aiSuggestions.length && aiSuggestions.length > 0}
											onchange={toggleAll} />
									</th>
									<th>明細</th>
									<th>建議分類</th>
									<th class="text-right">信心</th>
									<th>操作</th>
								</tr>
							</thead>
							<tbody>
								{#each aiSuggestions as s}
									<tr class="hover">
										<td>
											<input type="checkbox" class="checkbox checkbox-sm"
												checked={selectedSuggestions.has(s.id)}
												onchange={() => toggleSelection(s.id)} />
										</td>
										<td>{s.raw_category}</td>
										<td>{s.parent_name ? `${s.parent_name} > ` : ''}{s.suggested_category}</td>
										<td class="text-right tabular-nums">{Math.round(s.confidence * 100)}%</td>
										<td>
											<button class="btn btn-ghost btn-xs gap-0.5" onclick={() => resolveSuggestion(s.id, 'reject')}>
												<Icon icon={icons.cancel} class="text-sm" />忽略
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					<div class="card-actions justify-end mt-2">
						<button
							class="btn btn-success btn-sm gap-1"
							onclick={acceptSelected}
							disabled={selectedSuggestions.size === 0}
						>
							<Icon icon={icons.confirm} class="text-base" />確認選取 ({selectedSuggestions.size})
						</button>
					</div>
				{/if}
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
									<th>明細</th>
									<th>分類</th>
									<th>來源</th>
									<th>建立時間</th>
								</tr>
							</thead>
							<tbody>
								{#each aliases as alias}
									<tr class="hover">
										<td>{alias.raw_category}</td>
										<td>{alias.parent_name ? `${alias.parent_name} > ` : ''}{alias.category_name ?? alias.normalized_category}</td>
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

{#if aliasModalOpen}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div class="modal modal-open" role="dialog" onkeydown={(e) => { if (e.key === 'Escape') aliasModalOpen = false; }}>
		<div class="modal-box w-80">
			<button type="button" class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onclick={() => aliasModalOpen = false}>✕</button>
			<h3 class="font-bold text-lg mb-4">新增分類映射</h3>
			<div class="form-control mb-3">
				<div class="label"><span class="label-text font-semibold">明細</span></div>
				<input type="text" class="input input-bordered input-sm" bind:value={newAliasRaw} placeholder="例: 消夜/零食" />
			</div>
			<div class="form-control mb-3">
				<div class="label"><span class="label-text font-semibold">大類</span></div>
				<select class="select select-bordered select-sm w-full" bind:value={newAliasParentId} onchange={() => { newAliasCategoryId = null; }}>
					<option value={null}>-- 選擇 --</option>
					{#each categories as cat}
						<option value={cat.id}>{cat.icon ?? ''} {cat.name}</option>
					{/each}
				</select>
			</div>
			<div class="form-control mb-4">
				<div class="label"><span class="label-text font-semibold">子類</span></div>
				<select class="select select-bordered select-sm w-full" bind:value={newAliasCategoryId} disabled={!newAliasParentId}>
					<option value={null}>-- 選擇 --</option>
					{#each childOptions as child}
						<option value={child.id}>{child.name}</option>
					{/each}
				</select>
			</div>
			<div class="modal-action">
				<button class="btn btn-ghost btn-sm" onclick={() => aliasModalOpen = false}>取消</button>
				<button
					class="btn btn-primary btn-sm gap-1"
					onclick={() => createAlias(newAliasRaw, newAliasCategoryId)}
					disabled={!newAliasRaw || !newAliasCategoryId}
				>
					<Icon icon={icons.confirm} class="text-base" />確認
				</button>
			</div>
		</div>
		<button type="button" class="modal-backdrop" aria-label="關閉" onclick={() => aliasModalOpen = false}></button>
	</div>
{/if}
