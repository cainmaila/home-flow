<script lang="ts">
	import Icon from '@iconify/svelte';
	import { icons } from '$lib/icons';
	import type { CategoryParent, Installment } from '$lib/types';
	import { formatAmount } from '$lib/utils';
	import PaymentMethodPicker from '$lib/components/PaymentMethodPicker.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import Tag from '$lib/components/Tag.svelte';
	import { tagColor } from '$lib/tagColor';

	let installments: Installment[] = $state([]);
	let categories: CategoryParent[] = $state([]);
	let paymentMethods: { id: number; name: string }[] = $state([]);
	let availableTags: { id: number; name: string }[] = $state([]);
	let loading = $state(true);
	let error = $state('');
	let success = $state('');
	let saving = $state(false);

	// Form state (shared for add & edit)
	let editingId: string | null = $state(null);
	let formTotalAmount = $state('');
	let formPeriods = $state('');
	let formStartMonth = $state('');
	let formCategoryId = $state<number | null>(null);
	let formDetail = $state('');
	let formTags = $state('');
	let formPaymentMethod = $state('現金');

	let dialogEl: HTMLDialogElement | undefined = $state(undefined);
	let deletingId: string | null = $state(null);

	async function load() {
		loading = true;
		error = '';
		try {
			const [instRes, catRes, pmRes, tagsRes] = await Promise.all([
				fetch('/api/installments'),
				fetch('/api/categories/manage'),
				fetch('/api/payment-methods'),
				fetch('/api/tags')
			]);
			if (instRes.ok) installments = await instRes.json();
			else error = '分期資料載入失敗';
			if (catRes.ok) categories = await catRes.json();
			if (pmRes.ok) paymentMethods = await pmRes.json();
			if (tagsRes.ok) availableTags = await tagsRes.json();
		} catch { error = '網路錯誤'; }
		finally { loading = false; }
	}

	$effect(() => { load(); });

	$effect(() => {
		if (!success) return;
		const t = setTimeout(() => (success = ''), 4000);
		return () => clearTimeout(t);
	});

	function openAdd() {
		editingId = null;
		formTotalAmount = '';
		formPeriods = '';
		const now = new Date();
		formStartMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
		formCategoryId = null;
		formDetail = '';
		formTags = '';
		formPaymentMethod = '現金';
		dialogEl?.showModal();
	}

	function openEdit(inst: Installment) {
		editingId = inst.id;
		formTotalAmount = String(inst.total_amount);
		formPeriods = String(inst.periods);
		formStartMonth = inst.start_month;
		formCategoryId = inst.category_id;
		formDetail = inst.detail ?? '';
		formTags = (inst.tags ?? []).join(',');
		formPaymentMethod = inst.payment_method;
		dialogEl?.showModal();
	}

	function closeModal() {
		dialogEl?.close();
	}

	let perPeriod = $derived.by(() => {
		const total = Number(formTotalAmount);
		const p = Number(formPeriods);
		if (!total || !p || p < 1) return null;
		return Math.floor(total / p);
	});

	async function submitForm() {
		const total = Number(formTotalAmount);
		const periods = Number(formPeriods);
		if (!total || total <= 0 || !periods || periods < 1 || !Number.isInteger(periods) || !formStartMonth) return;

		saving = true;
		error = '';
		try {
			const body = {
				total_amount: total,
				periods,
				start_month: formStartMonth,
				category_id: formCategoryId,
				detail: formDetail.trim() || undefined,
				tags: formTags.split(',').map((t: string) => t.trim()).filter(Boolean),
				payment_method: formPaymentMethod
			};

			const res = editingId
				? await fetch(`/api/installments/${editingId}`, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(body)
					})
				: await fetch('/api/installments', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(body)
					});

			if (!res.ok) {
				error = await res.text();
				return;
			}
			success = editingId ? '已更新分期設定，所有月份已重新計算' : '已新增分期付款';
			closeModal();
			await load();
		} catch { error = '網路錯誤'; }
		finally { saving = false; }
	}

	async function doDelete() {
		if (!deletingId) return;
		saving = true;
		try {
			const res = await fetch(`/api/installments/${deletingId}`, { method: 'DELETE' });
			if (!res.ok) { error = '刪除失敗'; return; }
			deletingId = null;
			success = '已刪除分期付款及所有相關交易';
			await load();
		} catch { error = '網路錯誤'; }
		finally { saving = false; }
	}

	let formValid = $derived(
		Number(formTotalAmount) > 0 &&
		Number(formPeriods) >= 1 &&
		Number.isInteger(Number(formPeriods)) &&
		!!formStartMonth
	);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">分期付款管理</h1>
		<button class="btn btn-primary btn-sm gap-1" onclick={openAdd}>
			<Icon icon={icons.addCircle} class="text-base" />新增分期
		</button>
	</div>

	{#if error}<div class="alert alert-error text-sm"><span>{error}</span><button class="btn btn-ghost btn-xs ml-auto" aria-label="關閉" onclick={() => (error = '')}><Icon icon={icons.close} class="text-sm" /></button></div>{/if}
	{#if success}<div class="alert alert-success text-sm"><span>{success}</span></div>{/if}

	{#if loading}
		<div class="flex justify-center items-center gap-3 py-12 text-base-content/60">
			<span class="loading loading-spinner loading-lg"></span> 載入中…
		</div>
	{:else if installments.length === 0}
		<div class="text-center py-12 text-base-content/50">尚無分期付款。點擊右上角新增。</div>
	{:else}
		<div class="space-y-3">
			{#each installments as inst}
				<div class="card bg-base-100 shadow">
					<div class="card-body py-4">
						<div class="flex flex-wrap items-center gap-3">
							<div class="flex-1 min-w-0 space-y-1">
								<div class="flex items-center gap-2 flex-wrap">
									<span class="font-semibold text-lg tabular-nums">{formatAmount(inst.total_amount)} 元</span>
									<span class="badge badge-neutral badge-sm">{inst.periods} 期</span>
									<span class="badge badge-outline badge-sm">每期 {formatAmount(Math.floor(inst.total_amount / inst.periods))} 元</span>
								</div>
								{#if inst.detail}
									<div class="text-base font-medium text-base-content/90">{inst.detail}</div>
								{/if}
								<div class="text-sm text-base-content/60 flex flex-wrap items-center gap-x-2 gap-y-1">
									<span>起始 {inst.start_month} → {(() => {
										const [y, m] = inst.start_month.split('-').map(Number);
										const end = new Date(y, m - 1 + inst.periods - 1, 1);
										return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`;
									})()}</span>
									{#if inst.category_name}
										<span>· {#if inst.parent_category_name}<span class="text-base-content/45">{inst.parent_category_name} › </span>{/if}{inst.category_name}</span>
									{/if}
									<span>· 付款 {inst.payment_method}</span>
								</div>
								{#if inst.tags && inst.tags.length > 0}
									<div class="flex flex-wrap gap-1 mt-1">
										{#each inst.tags as tag}
											<Tag label={tag} color={tagColor(tag)} variant="outline" size="xs" />
										{/each}
									</div>
								{/if}
							</div>
							<div class="flex gap-1 shrink-0">
								<button class="btn btn-ghost btn-sm gap-0.5" onclick={() => openEdit(inst)}>
									<Icon icon={icons.edit} class="text-sm" />編輯
								</button>
								<button class="btn btn-ghost btn-sm gap-0.5 text-error" onclick={() => (deletingId = inst.id)}>
									<Icon icon={icons.delete} class="text-sm" />刪除
								</button>
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<dialog bind:this={dialogEl} class="modal" onclose={closeModal}>
	<div class="modal-box max-w-sm">
		<h3 class="font-bold text-lg">{editingId ? '編輯分期付款' : '新增分期付款'}</h3>
		{#if editingId}
			<p class="text-sm text-warning mt-1">修改後將重新計算所有月份的交易記錄。</p>
		{/if}
		<div class="space-y-4 mt-4">
			<label class="form-control w-full">
				<div class="label"><span class="label-text">總金額（元）*</span></div>
				<input class="input input-bordered" type="number" min="1" step="1" placeholder="如 120000" bind:value={formTotalAmount} />
			</label>

			<label class="form-control w-full">
				<div class="label"><span class="label-text">期數 *</span></div>
				<input class="input input-bordered" type="number" min="1" step="1" placeholder="如 12" bind:value={formPeriods} />
				{#if perPeriod !== null}
					<div class="label"><span class="label-text-alt text-base-content/60">每期約 {formatAmount(perPeriod)} 元，末期 {formatAmount(Number(formTotalAmount) - perPeriod * (Number(formPeriods) - 1))} 元</span></div>
				{/if}
			</label>

			<label class="form-control w-full">
				<div class="label"><span class="label-text">開始月份 *</span></div>
				<input class="input input-bordered" type="month" bind:value={formStartMonth} />
			</label>

			<label class="form-control w-full">
				<div class="label"><span class="label-text">分類</span></div>
				<select class="select select-bordered" bind:value={formCategoryId}>
					<option value={null}>未分類</option>
					{#each categories as group}
						<optgroup label={group.name}>
							{#each group.children as child}
								<option value={child.id}>{child.name}</option>
							{/each}
						</optgroup>
					{/each}
				</select>
			</label>

			<label class="form-control w-full">
				<div class="label"><span class="label-text">明細備註</span></div>
				<input class="input input-bordered" type="text" maxlength="200" placeholder="如：iPhone 24期分期" bind:value={formDetail} />
			</label>

			<div class="form-control w-full">
				<div class="label"><span class="label-text">標籤</span></div>
				<input class="input input-bordered input-sm" type="text" bind:value={formTags} placeholder="逗號分隔，例：老婆,3C" list="inst-tag-options" />
				<datalist id="inst-tag-options">
					{#each availableTags as tag}
						<option value={tag.name}></option>
					{/each}
				</datalist>
			</div>

			<div class="form-control w-full">
				<div class="label"><span class="label-text">付款方式</span></div>
				<PaymentMethodPicker
					methods={paymentMethods}
					bind:value={formPaymentMethod}
				/>
			</div>
		</div>

		<div class="modal-action">
			<button class="btn btn-ghost gap-1" onclick={closeModal} disabled={saving}>
				<Icon icon={icons.cancel} class="text-base" />取消
			</button>
			<button class="btn btn-primary gap-1" onclick={submitForm} disabled={saving || !formValid}>
				{#if saving}<span class="loading loading-spinner loading-xs"></span>{/if}
				<Icon icon={icons.save} class="text-base" />{editingId ? '儲存' : '新增'}
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>

<ConfirmModal
	open={!!deletingId}
	title="確認刪除分期付款"
	message="刪除後，此分期產生的所有月份交易記錄將一併刪除。此操作無法復原。"
	confirmLabel="刪除"
	loading={saving}
	onconfirm={doDelete}
	oncancel={() => (deletingId = null)}
/>
