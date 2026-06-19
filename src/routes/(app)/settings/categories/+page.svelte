<script lang="ts">
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
	let loading = $state(true);
	let error = $state('');
	let success = $state('');

	// Add form
	let addMode: 'none' | 'parent' | 'child' = $state('none');
	let addParentId: number | null = $state(null);
	let addName = $state('');
	let addDescription = $state('');
	let addIcon = $state('');
	let addColor = $state('');

	// Edit state
	let editingId: number | null = $state(null);
	let editName = $state('');
	let editDescription = $state('');
	let editIcon = $state('');
	let editColor = $state('');

	async function loadCategories() {
		loading = true;
		error = '';
		try {
			const res = await fetch(`/api/categories/manage?householdId=${HOUSEHOLD_ID}`);
			if (!res.ok) { error = '載入失敗'; return; }
			categories = await res.json();
		} catch { error = '網路錯誤'; }
		finally { loading = false; }
	}

	$effect(() => { loadCategories(); });

	async function addCategory() {
		if (!addName.trim()) return;
		error = ''; success = '';
		try {
			const body: Record<string, unknown> = {
				householdId: HOUSEHOLD_ID,
				name: addName.trim()
			};
			if (addMode === 'child' && addParentId) body.parentId = addParentId;
			if (addDescription.trim()) body.description = addDescription.trim();
			if (addIcon.trim()) body.icon = addIcon.trim();
			if (addColor.trim()) body.color = addColor.trim();

			const res = await fetch('/api/categories/manage', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
				error = String(data?.message ?? '新增失敗');
				return;
			}
			success = `已新增「${addName}」`;
			addName = ''; addDescription = ''; addIcon = ''; addColor = ''; addMode = 'none'; addParentId = null;
			await loadCategories();
		} catch { error = '網路錯誤'; }
	}

	function startEdit(cat: CategoryParent | CategoryChild, isParent: boolean) {
		editingId = cat.id;
		editName = cat.name;
		editIcon = cat.icon ?? '';
		editColor = cat.color ?? '';
		editDescription = isParent ? (cat as CategoryParent).description ?? '' : '';
	}

	async function saveEdit(id: number) {
		error = ''; success = '';
		const body: Record<string, unknown> = { id, householdId: HOUSEHOLD_ID };
		if (editName.trim()) body.name = editName.trim();
		if (editIcon !== undefined) body.icon = editIcon.trim() || undefined;
		if (editColor !== undefined) body.color = editColor.trim() || undefined;
		if (editDescription !== undefined) body.description = editDescription.trim() || undefined;

		try {
			const res = await fetch('/api/categories/manage', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
				error = String(data?.message ?? '更新失敗');
				return;
			}
			editingId = null;
			success = '已更新';
			await loadCategories();
		} catch { error = '網路錯誤'; }
	}

	async function deleteCategory(id: number, name: string) {
		error = ''; success = '';
		try {
			const res = await fetch('/api/categories/manage', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, householdId: HOUSEHOLD_ID })
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
				error = String(data?.message ?? '刪除失敗');
				return;
			}
			const result = (await res.json()) as { deleted_categories: number; affected_expenses: number };
			success = `已刪除「${name}」（${result.deleted_categories} 個分類，${result.affected_expenses} 筆費用受影響）`;
			await loadCategories();
		} catch { error = '網路錯誤'; }
	}

	function startAddChild(parentId: number) {
		addMode = 'child';
		addParentId = parentId;
		addName = ''; addIcon = ''; addColor = '';
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">分類管理</h1>
		<button class="btn btn-primary btn-sm" onclick={() => { addMode = 'parent'; addParentId = null; addName = ''; addDescription = ''; addIcon = ''; addColor = ''; }}>
			+ 新增大類
		</button>
	</div>

	{#if error}<div class="alert alert-error text-sm">{error}</div>{/if}
	{#if success}<div class="alert alert-success text-sm">{success}</div>{/if}

	{#if loading}
		<div class="flex justify-center py-12"><span class="loading loading-spinner loading-lg"></span></div>
	{:else}
		<!-- Add form -->
		{#if addMode !== 'none'}
			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<h2 class="card-title text-lg">{addMode === 'parent' ? '新增大類' : '新增子類'}</h2>
					<div class="flex flex-wrap gap-3 items-end">
						<label class="form-control w-full max-w-[12rem]">
							<div class="label"><span class="label-text">名稱</span></div>
							<input class="input input-bordered input-sm" bind:value={addName} placeholder="分類名稱" />
						</label>
						{#if addMode === 'parent'}
							<label class="form-control w-full max-w-[16rem]">
								<div class="label"><span class="label-text">說明（AI 參考）</span></div>
								<input class="input input-bordered input-sm" bind:value={addDescription} placeholder="涵蓋範圍" />
							</label>
						{/if}
						<label class="form-control w-full max-w-[5rem]">
							<div class="label"><span class="label-text">圖標</span></div>
							<input class="input input-bordered input-sm" bind:value={addIcon} placeholder="🍔" />
						</label>
						<label class="form-control w-full max-w-[7rem]">
							<div class="label"><span class="label-text">色碼</span></div>
							<input class="input input-bordered input-sm" bind:value={addColor} placeholder="#FF6B6B" />
						</label>
						<button class="btn btn-primary btn-sm" onclick={addCategory} disabled={!addName.trim()}>新增</button>
						<button class="btn btn-ghost btn-sm" onclick={() => { addMode = 'none'; }}>取消</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Category tree -->
		{#each categories as parent}
			<div class="card bg-base-100 shadow">
				<div class="card-body py-4">
					{#if editingId === parent.id}
						<div class="flex flex-wrap gap-3 items-end">
							<input class="input input-bordered input-sm w-32" bind:value={editName} />
							<input class="input input-bordered input-sm w-48" bind:value={editDescription} placeholder="說明" />
							<input class="input input-bordered input-sm w-16" bind:value={editIcon} placeholder="icon" />
							<input class="input input-bordered input-sm w-24" bind:value={editColor} placeholder="#color" />
							<button class="btn btn-success btn-xs" onclick={() => saveEdit(parent.id)}>存</button>
							<button class="btn btn-ghost btn-xs" onclick={() => { editingId = null; }}>消</button>
						</div>
					{:else}
						<div class="flex items-center gap-2">
							{#if parent.icon}<span class="text-lg">{parent.icon}</span>{/if}
							{#if parent.color}<span class="w-3 h-3 rounded-full inline-block" style="background-color:{parent.color}"></span>{/if}
							<h2 class="card-title text-lg">{parent.name}</h2>
							{#if parent.description}<span class="text-xs text-base-content/50">— {parent.description}</span>{/if}
							<div class="ml-auto flex gap-1">
								<button class="btn btn-ghost btn-xs" onclick={() => startEdit(parent, true)}>編輯</button>
								<button class="btn btn-ghost btn-xs text-error" onclick={() => deleteCategory(parent.id, parent.name)}>刪除</button>
								<button class="btn btn-ghost btn-xs" onclick={() => startAddChild(parent.id)}>+ 子類</button>
							</div>
						</div>
					{/if}

					{#if parent.children.length > 0}
						<div class="ml-6 mt-2 space-y-1">
							{#each parent.children as child}
								{#if editingId === child.id}
									<div class="flex gap-2 items-center">
										<input class="input input-bordered input-xs w-28" bind:value={editName} />
										<input class="input input-bordered input-xs w-14" bind:value={editIcon} placeholder="icon" />
										<input class="input input-bordered input-xs w-20" bind:value={editColor} placeholder="#color" />
										<button class="btn btn-success btn-xs" onclick={() => saveEdit(child.id)}>存</button>
										<button class="btn btn-ghost btn-xs" onclick={() => { editingId = null; }}>消</button>
									</div>
								{:else}
									<div class="flex items-center gap-2 py-1 px-2 rounded hover:bg-base-200">
										{#if child.icon}<span>{child.icon}</span>{/if}
										{#if child.color}<span class="w-2.5 h-2.5 rounded-full inline-block" style="background-color:{child.color}"></span>{/if}
										<span class="text-sm">{child.name}</span>
										<div class="ml-auto flex gap-1">
											<button class="btn btn-ghost btn-xs" onclick={() => startEdit(child, false)}>編輯</button>
											<button class="btn btn-ghost btn-xs text-error" onclick={() => deleteCategory(child.id, child.name)}>刪除</button>
										</div>
									</div>
								{/if}
							{/each}
						</div>
					{:else}
						<p class="text-sm text-base-content/40 ml-6 mt-2">尚無子類</p>
					{/if}
				</div>
			</div>
		{/each}

		{#if categories.length === 0}
			<div class="text-center py-12 text-base-content/50">尚無分類。點擊上方按鈕新增。</div>
		{/if}
	{/if}
</div>
