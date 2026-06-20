<script lang="ts">
	let open = $state(false);
	let saving = $state(false);
	let feedback = $state('');

	let expenseDate = $state(new Date().toISOString().slice(0, 10));
	let amount = $state('');
	let categoryId = $state<number | null>(null);
	let isFixed = $state(false);

	interface CategoryChild { id: number; name: string }
	interface CategoryGroup { id: number; name: string; children: CategoryChild[] }
	let categories: CategoryGroup[] = $state([]);
	let categoriesLoaded = false;

	let amountInput: HTMLInputElement | undefined = $state();

	async function loadCategories() {
		if (categoriesLoaded) return;
		try {
			const res = await fetch('/api/categories/manage');
			if (res.ok) categories = await res.json();
			categoriesLoaded = true;
		} catch { /* non-blocking */ }
	}

	function openModal() {
		open = true;
		feedback = '';
		loadCategories();
		// focus after DOM update
		requestAnimationFrame(() => amountInput?.focus());
	}

	function closeModal() {
		open = false;
	}

	async function submit() {
		if (!amount || !categoryId) return;
		saving = true;
		feedback = '';
		try {
			const res = await fetch('/api/expenses', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					expense_date: expenseDate,
					amount: Number(amount),
					category_id: categoryId,
					is_fixed_expense: isFixed
				})
			});
			if (!res.ok) {
				const err = await res.json().catch(() => null) as { message?: string } | null;
				feedback = `失敗: ${err?.message ?? res.statusText}`;
				return;
			}
			feedback = '✓ 已新增';
			amount = '';
			requestAnimationFrame(() => amountInput?.focus());
		} catch {
			feedback = '網路錯誤';
		} finally {
			saving = false;
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeModal();
		if (e.key === 'Enter' && !saving) { e.preventDefault(); submit(); }
	}
</script>

<button class="btn btn-ghost btn-sm" onclick={openModal}>+ 記一筆</button>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div class="modal modal-open" role="dialog" onkeydown={onKeydown}>
		<div class="modal-box w-80">
			<h3 class="font-bold text-lg mb-4">新增支出</h3>

			<div class="form-control mb-2">
				<label class="label" for="add-date"><span class="label-text">日期</span></label>
				<input id="add-date" type="date" class="input input-bordered input-sm" bind:value={expenseDate} />
			</div>

			<div class="form-control mb-2">
				<label class="label" for="add-amount"><span class="label-text">金額</span></label>
				<input
					id="add-amount"
					type="number"
					inputmode="decimal"
					class="input input-bordered input-sm"
					bind:value={amount}
					bind:this={amountInput}
					min="1"
					placeholder="0"
				/>
			</div>

			<div class="form-control mb-2">
				<label class="label" for="add-category"><span class="label-text">分類</span></label>
				<select id="add-category" class="select select-bordered select-sm" bind:value={categoryId}>
					<option value={null} disabled>選擇分類</option>
					{#each categories as group}
						<optgroup label={group.name}>
							{#each group.children as child}
								<option value={child.id}>{child.name}</option>
							{/each}
						</optgroup>
					{/each}
				</select>
			</div>

			<div class="form-control mb-4">
				<label class="label cursor-pointer justify-start gap-2">
					<input type="checkbox" class="checkbox checkbox-sm" bind:checked={isFixed} />
					<span class="label-text">固定支出</span>
				</label>
			</div>

			{#if feedback}
				<p class="text-sm mb-2" class:text-success={feedback.startsWith('✓')} class:text-error={!feedback.startsWith('✓')}>{feedback}</p>
			{/if}

			<div class="modal-action">
				<button class="btn btn-ghost btn-sm" onclick={closeModal}>關閉</button>
				<button class="btn btn-primary btn-sm" onclick={submit} disabled={saving || !amount || !categoryId}>
					{saving ? '儲存中…' : '新增'}
				</button>
			</div>
		</div>
		<button type="button" class="modal-backdrop" aria-label="關閉" onclick={closeModal}></button>
	</div>
{/if}
