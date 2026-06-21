<script lang="ts">
	import Icon from '@iconify/svelte';
	import { icons } from '$lib/icons';
	import CategoryIcon from '$lib/components/CategoryIcon.svelte';
	import IconPicker from '$lib/components/IconPicker.svelte';
	import type { CategoryChild, CategoryParent } from '$lib/types';
	import { HOUSEHOLD_ID } from '$lib/utils';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';

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

	// Auto-dismiss success toast after 5s
	$effect(() => {
		if (!success) return;
		const t = setTimeout(() => (success = ''), 5000);
		return () => clearTimeout(t);
	});

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

	function editKeydown(e: KeyboardEvent, id: number) {
		if (e.key === 'Enter') { e.preventDefault(); saveEdit(id); }
		else if (e.key === 'Escape') { e.preventDefault(); editingId = null; showEditIconPicker = false; }
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

	let editNameInvalid = $derived(editingId !== null && editName.trim() === '');

	async function saveEdit(id: number) {
		if (!editName.trim()) return; // empty name no-ops silently otherwise
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

	// Delete confirm
	let pendingDelete: { id: number; name: string; isParent: boolean } | null = $state(null);
	let deleting = $state(false);

	async function confirmDelete() {
		if (!pendingDelete) return;
		const { id, name } = pendingDelete;
		error = ''; success = ''; deleting = true;
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
			pendingDelete = null;
			await loadCategories();
		} catch { error = '網路錯誤'; }
		finally { deleting = false; }
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">分類管理</h1>
		<button class="btn btn-primary btn-sm gap-1" onclick={openAddParent}><Icon icon={icons.addCircle} class="text-base" />新增大類</button>
	</div>

	{#if error}<div class="alert alert-error text-sm"><span>{error}</span><button class="btn btn-ghost btn-xs ml-auto" aria-label="關閉" onclick={() => (error = '')}><Icon icon={icons.close} class="text-sm" /></button></div>{/if}
	{#if success}<div class="alert alert-success text-sm"><span>{success}</span><button class="btn btn-ghost btn-xs ml-auto" aria-label="關閉" onclick={() => (success = '')}><Icon icon={icons.close} class="text-sm" /></button></div>{/if}

	{#if loading}
		<div class="flex justify-center items-center gap-3 py-12 text-base-content/60"><span class="loading loading-spinner loading-lg"></span> 載入中…</div>
	{:else}
		{#each categories as parent}
			<div class="card bg-base-100 shadow">
				<div class="card-body py-4">
					{#if editingId === parent.id}
						<div class="space-y-3">
							<div class="flex flex-wrap gap-3 items-end">
								<label class="form-control w-full max-w-[10rem]">
									<div class="label"><span class="label-text">名稱</span></div>
									<input class="input input-bordered input-sm" class:input-error={editNameInvalid} bind:value={editName} onkeydown={(e) => editKeydown(e, parent.id)} />
								</label>
								<label class="form-control w-full max-w-[14rem]">
									<div class="label"><span class="label-text">說明</span></div>
									<input class="input input-bordered input-sm" bind:value={editDescription} placeholder="涵蓋範圍" onkeydown={(e) => editKeydown(e, parent.id)} />
								</label>
							</div>
							<div class="flex flex-wrap gap-3 items-center">
								<div class="flex items-center gap-2">
									<span class="label-text">圖標</span>
									<button class="btn btn-outline btn-sm min-w-[3rem]" onclick={() => showEditIconPicker = !showEditIconPicker}>
										{#if editIcon}<CategoryIcon icon={editIcon} class="text-lg" />{:else}選擇{/if}
									</button>
									{#if editIcon}<button class="btn btn-ghost btn-xs" aria-label="清除圖標" onclick={() => editIcon = ''}><Icon icon={icons.close} class="text-sm" /></button>{/if}
								</div>
								<div class="flex items-center gap-2">
									<label class="flex items-center gap-1 cursor-pointer">
										<input type="checkbox" class="checkbox checkbox-xs" bind:checked={editColorEnabled} />
										<span class="label-text">顏色</span>
									</label>
									{#if editColorEnabled}
										<input type="color" class="w-8 h-8 rounded cursor-pointer border-0" bind:value={editColor} />
									{/if}
								</div>
								<div class="ml-auto flex gap-1">
									<button class="btn btn-success btn-sm gap-0.5" onclick={() => saveEdit(parent.id)}><Icon icon={icons.save} class="text-base" />儲存</button>
									<button class="btn btn-ghost btn-sm gap-0.5" onclick={() => { editingId = null; showEditIconPicker = false; }}><Icon icon={icons.cancel} class="text-base" />取消</button>
								</div>
							</div>
							{#if showEditIconPicker}
								<IconPicker selected={editIcon} onselect={(icon) => { editIcon = icon; showEditIconPicker = false; }} />
							{/if}
						</div>
					{:else}
						<div class="flex items-center gap-2">
							{#if parent.icon}<CategoryIcon icon={parent.icon} class="text-lg" />{/if}
							{#if parent.color}<span class="w-3 h-3 rounded-full inline-block" style="background-color:{parent.color}"></span>{/if}
							<h2 class="card-title text-lg">{parent.name}</h2>
							{#if parent.description}<span class="text-xs text-base-content/50">— {parent.description}</span>{/if}
							<div class="ml-auto flex gap-1">
								<button class="btn btn-ghost btn-xs gap-0.5" onclick={() => startEdit(parent, true)}><Icon icon={icons.edit} class="text-sm" />編輯</button>
								<button class="btn btn-ghost btn-xs gap-0.5 text-error" onclick={() => pendingDelete = { id: parent.id, name: parent.name, isParent: true }}><Icon icon={icons.delete} class="text-sm" />刪除</button>
								<button class="btn btn-primary btn-xs gap-0.5" onclick={() => openAddChild(parent.id, parent.name)}><Icon icon={icons.add} class="text-sm" />子類</button>
							</div>
						</div>
					{/if}

					{#if parent.children.length > 0}
						<div class="ml-6 mt-2 flex flex-wrap gap-2 items-start">
							{#each parent.children as child}
								{#if editingId === child.id}
									<div class="w-full space-y-2 py-2 px-2 bg-base-200 rounded">
										<div class="flex flex-wrap gap-2 items-center">
											<input class="input input-bordered input-xs w-28" class:input-error={editNameInvalid} bind:value={editName} onkeydown={(e) => editKeydown(e, child.id)} />
											<div class="flex items-center gap-1">
												<button class="btn btn-outline btn-xs min-w-[2.5rem]" onclick={() => showEditIconPicker = !showEditIconPicker}>
													{#if editIcon}<CategoryIcon icon={editIcon} />{:else}<Icon icon={icons.pin} />{/if}
												</button>
												{#if editIcon}<button class="btn btn-ghost btn-xs" aria-label="清除圖標" onclick={() => editIcon = ''}><Icon icon={icons.close} class="text-sm" /></button>{/if}
											</div>
											<label class="flex items-center gap-1 cursor-pointer">
												<input type="checkbox" class="checkbox checkbox-xs" bind:checked={editColorEnabled} />
												{#if editColorEnabled}
													<input type="color" class="w-6 h-6 rounded cursor-pointer border-0" bind:value={editColor} />
												{/if}
											</label>
											<button class="btn btn-success btn-xs gap-0.5" onclick={() => saveEdit(child.id)}><Icon icon={icons.save} class="text-sm" />儲存</button>
											<button class="btn btn-ghost btn-xs gap-0.5" onclick={() => { editingId = null; showEditIconPicker = false; }}><Icon icon={icons.cancel} class="text-sm" />取消</button>
										</div>
										{#if showEditIconPicker}
											<IconPicker selected={editIcon} size="xs" onselect={(icon) => { editIcon = icon; showEditIconPicker = false; }} />
										{/if}
									</div>
								{:else}
									<div
									class="group inline-flex items-center gap-1.5 rounded-full py-1 px-3 text-sm border cursor-default transition-colors"
									class:bg-base-200={!child.color}
									class:border-base-300={!child.color}
									style={child.color ? `background-color:${child.color}1a;border-color:${child.color}55` : ''}
								>
										{#if child.icon}<CategoryIcon icon={child.icon} />{/if}
										<span>{child.name}</span>
										<div class="flex gap-0.5 lg:hidden lg:group-hover:flex">
											<button class="btn btn-ghost btn-xs btn-circle" onclick={() => startEdit(child, false)}><Icon icon={icons.edit} class="text-sm" /></button>
											<button class="btn btn-ghost btn-xs btn-circle text-error" onclick={() => pendingDelete = { id: child.id, name: child.name, isParent: false }}><Icon icon={icons.delete} class="text-sm" /></button>
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
						{#if modalIcon}<CategoryIcon icon={modalIcon} class="text-lg" />{:else}選擇{/if}
					</button>
					{#if modalIcon}
						<button class="btn btn-ghost btn-sm gap-0.5" onclick={() => modalIcon = ''}><Icon icon={icons.close} class="text-sm" />清除</button>
					{/if}
				</div>
				{#if showIconPicker}
					<div class="mt-2">
						<IconPicker selected={modalIcon} onselect={(icon) => { modalIcon = icon; showIconPicker = false; }} />
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
			<button class="btn btn-ghost gap-1" onclick={closeModal}><Icon icon={icons.cancel} class="text-base" />取消</button>
			<button class="btn btn-primary gap-1" onclick={submitAdd} disabled={!modalName.trim()}><Icon icon={icons.addCircle} class="text-base" />新增</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>

<ConfirmModal
	open={!!pendingDelete}
	title="確認刪除"
	message={pendingDelete ? `確定要刪除「<strong>${pendingDelete.name}</strong>」嗎？${pendingDelete.isParent ? '其子分類會一併刪除，' : ''}相關費用會變成未分類。此操作無法復原。` : ''}
	confirmLabel="刪除"
	loading={deleting}
	onconfirm={confirmDelete}
	oncancel={() => (pendingDelete = null)}
/>
