<script lang="ts">
	const HOUSEHOLD_ID = 'default';
	const ICONS = ['🍔','🍜','🍳','☕','🥤','🍎','🍪','👕','🏠','💧','⚡','🔥','🚗','⛽','🅿️','🚌','📚','🎮','🎬','💊','💰','📱','🛒','🎁','✂️','🧹','🐾','👶','💳','📦'];

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

	// Modal state
	let modalOpen = $state(false);
	let modalMode: 'parent' | 'child' = $state('parent');
	let modalParentId: number | null = $state(null);
	let modalParentName = $state('');
	let modalName = $state('');
	let modalDescription = $state('');
	let modalIcon = $state('');
	let modalColor = $state('#6366f1');
	let modalColorEnabled = $state(false);
	let showIconPicker = $state(false);

	// Edit state
	let editingId: number | null = $state(null);
	let editName = $state('');
	let editDescription = $state('');
	let editIcon = $state('');
	let editColor = $state('');
	let editColorEnabled = $state(false);
	let showEditIconPicker = $state(false);

	let dialogEl: HTMLDialogElement | undefined = $state(undefined);

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

	function openAddParent() {
		modalMode = 'parent';
		modalParentId = null;
		modalParentName = '';
		modalName = ''; modalDescription = ''; modalIcon = ''; modalColor = '#6366f1'; modalColorEnabled = false; showIconPicker = false;
		modalOpen = true;
		dialogEl?.showModal();
	}

	function openAddChild(parentId: number, parentName: string) {
		modalMode = 'child';
		modalParentId = parentId;
		modalParentName = parentName;
		modalName = ''; modalDescription = ''; modalIcon = ''; modalColor = '#6366f1'; modalColorEnabled = false; showIconPicker = false;
		modalOpen = true;
		dialogEl?.showModal();
	}

	function closeModal() {
		modalOpen = false;
		showIconPicker = false;
		dialogEl?.close();
	}

	async function submitAdd() {
		if (!modalName.trim()) return;
		error = ''; success = '';
		try {
			const body: Record<string, unknown> = {
				householdId: HOUSEHOLD_ID,
				name: modalName.trim()
			};
			if (modalMode === 'child' && modalParentId) body.parentId = modalParentId;
			if (modalDescription.trim()) body.description = modalDescription.trim();
			if (modalIcon.trim()) body.icon = modalIcon.trim();
			if (modalColorEnabled) body.color = modalColor;

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
			success = `已新增「${modalName}」`;
			closeModal();
			await loadCategories();
		} catch { error = '網路錯誤'; }
	}

	function startEdit(cat: CategoryParent | CategoryChild, isParent: boolean) {
		editingId = cat.id;
		editName = cat.name;
		editIcon = cat.icon ?? '';
		editColor = cat.color ?? '#6366f1';
		editColorEnabled = !!cat.color;
		editDescription = isParent ? (cat as CategoryParent).description ?? '' : '';
		showEditIconPicker = false;
	}

	async function saveEdit(id: number) {
		error = ''; success = '';
		const body: Record<string, unknown> = { id, householdId: HOUSEHOLD_ID };
		if (editName.trim()) body.name = editName.trim();
		body.icon = editIcon.trim() || undefined;
		body.color = editColorEnabled ? editColor : undefined;
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
			showEditIconPicker = false;
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
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">分類管理</h1>
		<button class="btn btn-primary btn-sm" onclick={openAddParent}>+ 新增大類</button>
	</div>

	{#if error}<div class="alert alert-error text-sm">{error}</div>{/if}
	{#if success}<div class="alert alert-success text-sm">{success}</div>{/if}

	{#if loading}
		<div class="flex justify-center py-12"><span class="loading loading-spinner loading-lg"></span></div>
	{:else}
		{#each categories as parent}
			<div class="card bg-base-100 shadow">
				<div class="card-body py-4">
					{#if editingId === parent.id}
						<div class="space-y-3">
							<div class="flex flex-wrap gap-3 items-end">
								<label class="form-control w-full max-w-[10rem]">
									<div class="label"><span class="label-text">名稱</span></div>
									<input class="input input-bordered input-sm" bind:value={editName} />
								</label>
								<label class="form-control w-full max-w-[14rem]">
									<div class="label"><span class="label-text">說明</span></div>
									<input class="input input-bordered input-sm" bind:value={editDescription} placeholder="涵蓋範圍" />
								</label>
							</div>
							<div class="flex flex-wrap gap-3 items-center">
								<div class="flex items-center gap-2">
									<span class="text-sm">圖標</span>
									<button class="btn btn-outline btn-sm min-w-[3rem]" onclick={() => showEditIconPicker = !showEditIconPicker}>
										{editIcon || '選擇'}
									</button>
									{#if editIcon}<button class="btn btn-ghost btn-xs" onclick={() => editIcon = ''}>✕</button>{/if}
								</div>
								<div class="flex items-center gap-2">
									<label class="flex items-center gap-1 cursor-pointer">
										<input type="checkbox" class="checkbox checkbox-xs" bind:checked={editColorEnabled} />
										<span class="text-sm">顏色</span>
									</label>
									{#if editColorEnabled}
										<input type="color" class="w-8 h-8 rounded cursor-pointer border-0" bind:value={editColor} />
									{/if}
								</div>
								<div class="ml-auto flex gap-1">
									<button class="btn btn-success btn-sm" onclick={() => saveEdit(parent.id)}>儲存</button>
									<button class="btn btn-ghost btn-sm" onclick={() => { editingId = null; showEditIconPicker = false; }}>取消</button>
								</div>
							</div>
							{#if showEditIconPicker}
								<div class="flex flex-wrap gap-1 p-2 bg-base-200 rounded-lg max-w-sm">
									{#each ICONS as icon}
										<button
											class="btn btn-ghost btn-sm text-lg px-1.5"
											class:btn-active={editIcon === icon}
											onclick={() => { editIcon = icon; showEditIconPicker = false; }}
										>{icon}</button>
									{/each}
								</div>
							{/if}
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
								<button class="btn btn-primary btn-xs" onclick={() => openAddChild(parent.id, parent.name)}>+ 子類</button>
							</div>
						</div>
					{/if}

					{#if parent.children.length > 0}
						<div class="ml-6 mt-2 space-y-1">
							{#each parent.children as child}
								{#if editingId === child.id}
									<div class="space-y-2 py-2 px-2 bg-base-200 rounded">
										<div class="flex flex-wrap gap-2 items-center">
											<input class="input input-bordered input-xs w-28" bind:value={editName} />
											<div class="flex items-center gap-1">
												<button class="btn btn-outline btn-xs min-w-[2.5rem]" onclick={() => showEditIconPicker = !showEditIconPicker}>
													{editIcon || '📌'}
												</button>
												{#if editIcon}<button class="btn btn-ghost btn-xs" onclick={() => editIcon = ''}>✕</button>{/if}
											</div>
											<label class="flex items-center gap-1 cursor-pointer">
												<input type="checkbox" class="checkbox checkbox-xs" bind:checked={editColorEnabled} />
												{#if editColorEnabled}
													<input type="color" class="w-6 h-6 rounded cursor-pointer border-0" bind:value={editColor} />
												{/if}
											</label>
											<button class="btn btn-success btn-xs" onclick={() => saveEdit(child.id)}>存</button>
											<button class="btn btn-ghost btn-xs" onclick={() => { editingId = null; showEditIconPicker = false; }}>消</button>
										</div>
										{#if showEditIconPicker}
											<div class="flex flex-wrap gap-1 p-2 bg-base-100 rounded-lg max-w-xs">
												{#each ICONS as icon}
													<button
														class="btn btn-ghost btn-xs text-base px-1"
														class:btn-active={editIcon === icon}
														onclick={() => { editIcon = icon; showEditIconPicker = false; }}
													>{icon}</button>
												{/each}
											</div>
										{/if}
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

<!-- Add Modal -->
<dialog bind:this={dialogEl} class="modal" onclose={closeModal}>
	<div class="modal-box max-w-sm">
		<h3 class="font-bold text-lg">
			{modalMode === 'parent' ? '新增大類' : `新增子類 → ${modalParentName}`}
		</h3>
		<div class="space-y-4 mt-4">
			<label class="form-control w-full">
				<div class="label"><span class="label-text">名稱 *</span></div>
				<input class="input input-bordered" bind:value={modalName} placeholder="分類名稱" />
			</label>

			{#if modalMode === 'parent'}
				<label class="form-control w-full">
					<div class="label"><span class="label-text">說明（AI 分類參考）</span></div>
					<input class="input input-bordered" bind:value={modalDescription} placeholder="涵蓋範圍描述" />
				</label>
			{/if}

			<!-- Icon picker -->
			<div>
				<div class="label"><span class="label-text">圖標</span></div>
				<div class="flex items-center gap-2">
					<button class="btn btn-outline min-w-[3rem] text-lg" onclick={() => showIconPicker = !showIconPicker}>
						{modalIcon || '選擇'}
					</button>
					{#if modalIcon}
						<button class="btn btn-ghost btn-sm" onclick={() => modalIcon = ''}>清除</button>
					{/if}
				</div>
				{#if showIconPicker}
					<div class="flex flex-wrap gap-1 p-2 mt-2 bg-base-200 rounded-lg">
						{#each ICONS as icon}
							<button
								class="btn btn-ghost btn-sm text-lg px-1.5"
								class:btn-active={modalIcon === icon}
								onclick={() => { modalIcon = icon; showIconPicker = false; }}
							>{icon}</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Color picker -->
			<div>
				<div class="flex items-center gap-2">
					<label class="flex items-center gap-2 cursor-pointer">
						<input type="checkbox" class="checkbox checkbox-sm" bind:checked={modalColorEnabled} />
						<span class="label-text">自訂顏色</span>
					</label>
					{#if modalColorEnabled}
						<input type="color" class="w-10 h-10 rounded cursor-pointer border-0" bind:value={modalColor} />
						<span class="text-sm text-base-content/60">{modalColor}</span>
					{/if}
				</div>
			</div>
		</div>

		<div class="modal-action">
			<button class="btn btn-ghost" onclick={closeModal}>取消</button>
			<button class="btn btn-primary" onclick={submitAdd} disabled={!modalName.trim()}>新增</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>
