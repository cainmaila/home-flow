<script lang="ts">
	const MAX_SIZE = 10 * 1024 * 1024; // 10MB
	const currentYear = new Date().getFullYear();
	const HOUSEHOLD_ID = 'default';

	let fileInput: HTMLInputElement | undefined = $state();
	let year: number = $state(currentYear);
	let status: 'idle' | 'uploading' | 'previewing' | 'previewed' | 'committing' | 'committed' | 'error' = $state('idle');
	let committing: boolean = $state(false);
	let errorMessage: string = $state('');

	let uploadResult: {
		ok: boolean;
		recordCount: number;
		records: { expense_date: string; raw_category: string; amount: number }[];
		errors: { severity: string; message: string }[];
	} | null = $state(null);

	let previewResult: {
		importId: string;
		records: {
			record: { household_id: string; expense_date: string; raw_category: string; normalized_category: string | null; amount: number; is_fixed_expense: boolean; source_import_id: string | null };
			status: 'new' | 'duplicate' | 'update';
			existingAmount?: number;
			resolution?: 'use_new' | 'keep_old' | 'skip';
		}[];
		summary: { parsed: number; newRecords: number; duplicates: number; updates: number };
	} | null = $state(null);

	let commitResult: {
		importId: string;
		inserted: number;
		duplicates: number;
		updated: number;
		skipped: number;
		aiSuggestions?: { autoAccepted: number; pending: number; total: number };
	} | null = $state(null);

	let filename: string = $state('');

	async function handleUpload() {
		const file = fileInput?.files?.[0];
		if (!file) {
			errorMessage = '請選擇檔案';
			status = 'error';
			return;
		}

		if (file.size > MAX_SIZE) {
			errorMessage = '檔案大小超過 10MB 限制';
			status = 'error';
			return;
		}

		status = 'uploading';
		errorMessage = '';
		uploadResult = null;
		previewResult = null;
		commitResult = null;
		filename = file.name;

		const formData = new FormData();
		formData.append('file', file);
		formData.append('year', String(year));

		try {
			const res = await fetch('/api/import/upload', {
				method: 'POST',
				body: formData
			});

			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
				errorMessage = String(body?.message ?? `上傳失敗 (${res.status})`);
				status = 'error';
				return;
			}

			uploadResult = await res.json();
			if (!uploadResult?.ok) {
				errorMessage = '解析失敗，請檢查檔案格式';
				status = 'error';
				return;
			}

			await runPreview();
		} catch {
			errorMessage = '網路錯誤，請再試一次';
			status = 'error';
		}
	}

	async function runPreview() {
		if (!uploadResult?.records?.length) return;

		status = 'previewing';
		try {
			const res = await fetch('/api/import/preview', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					records: uploadResult.records,
					householdId: HOUSEHOLD_ID,
					filename
				})
			});

			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
				errorMessage = String(body?.message ?? `預覽失敗 (${res.status})`);
				status = 'error';
				return;
			}

			previewResult = await res.json();
			status = 'previewed';
		} catch {
			errorMessage = '網路錯誤，請再試一次';
			status = 'error';
		}
	}

	function setResolution(index: number, value: 'use_new' | 'keep_old' | 'skip') {
		if (!previewResult) return;
		previewResult.records[index].resolution = value;
	}

	async function handleCommit() {
		if (!previewResult) return;

		committing = true;
		status = 'committing';
		errorMessage = '';

		try {
			const res = await fetch('/api/import/commit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					importId: previewResult.importId,
					householdId: HOUSEHOLD_ID,
					records: previewResult.records
				})
			});

			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
				errorMessage = String(body?.message ?? `確認匯入失敗 (${res.status})`);
				status = 'error';
				return;
			}

			commitResult = await res.json();
			status = 'committed';
			committing = false;
		} catch {
			errorMessage = '網路錯誤，請再試一次';
			status = 'error';
			committing = false;
		}
	}

	function reset() {
		status = 'idle';
		committing = false;
		errorMessage = '';
		uploadResult = null;
		previewResult = null;
		commitResult = null;
		filename = '';
		if (fileInput) fileInput.value = '';
	}
</script>

<div class="space-y-6">
	<h1 class="text-2xl font-bold">匯入 CSV</h1>

	{#if status === 'committed' && commitResult}
		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title text-lg">匯入完成</h2>
				<div class="overflow-x-auto">
					<table class="table table-sm w-auto">
						<tbody>
							<tr><td>新增</td><td class="font-semibold">{commitResult.inserted} 筆</td></tr>
							<tr><td>重複略過</td><td class="font-semibold">{commitResult.duplicates} 筆</td></tr>
							<tr><td>更新</td><td class="font-semibold">{commitResult.updated} 筆</td></tr>
							<tr><td>略過</td><td class="font-semibold">{commitResult.skipped} 筆</td></tr>
							{#if commitResult.aiSuggestions}
								<tr><td>AI 自動採納</td><td class="font-semibold">{commitResult.aiSuggestions.autoAccepted} 筆</td></tr>
								<tr><td>AI 待人工確認</td><td class="font-semibold">{commitResult.aiSuggestions.pending} 筆</td></tr>
							{/if}
						</tbody>
					</table>
				</div>
				{#if commitResult.aiSuggestions && commitResult.aiSuggestions.pending > 0}
					<div class="alert alert-info text-sm">
						有 {commitResult.aiSuggestions.pending} 筆低信心建議，請至
						<a href="/corrections" class="link">分類校正</a> 頁確認。
					</div>
				{/if}
				<div class="card-actions mt-4">
					<button class="btn btn-primary btn-sm" onclick={reset}>匯入其他檔案</button>
					<a href="/import/history" class="btn btn-ghost btn-sm">查看匯入歷程</a>
				</div>
			</div>
		</div>
	{:else if status === 'previewed' && previewResult}
		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<h2 class="card-title text-lg">預覽結果</h2>
				<table class="table table-sm w-auto">
					<tbody>
						<tr><td>解析筆數</td><td class="font-semibold">{previewResult.summary.parsed}</td></tr>
						<tr><td>新增</td><td class="font-semibold">{previewResult.summary.newRecords}</td></tr>
						<tr><td>重複</td><td class="font-semibold">{previewResult.summary.duplicates}</td></tr>
						<tr><td>更新候選</td><td class="font-semibold">{previewResult.summary.updates}</td></tr>
					</tbody>
				</table>

				{#if previewResult.records.some((r) => r.status === 'update')}
					<h3 class="font-semibold mt-4">更新候選</h3>
					<div class="overflow-x-auto">
						<table class="table table-sm">
							<thead>
								<tr>
									<th>日期</th>
									<th>分類</th>
									<th class="text-right">舊金額</th>
									<th class="text-right">新金額</th>
									<th>處理方式</th>
								</tr>
							</thead>
							<tbody>
								{#each previewResult.records as pr, i}
									{#if pr.status === 'update'}
										<tr>
											<td>{pr.record.expense_date}</td>
											<td>{pr.record.raw_category}</td>
											<td class="text-right tabular-nums">{pr.existingAmount}</td>
											<td class="text-right tabular-nums">{pr.record.amount}</td>
											<td>
												<select
													class="select select-bordered select-xs"
													value={pr.resolution ?? 'use_new'}
													onchange={(e) => setResolution(i, (e.target as HTMLSelectElement).value as 'use_new' | 'keep_old' | 'skip')}
												>
													<option value="use_new">使用新值</option>
													<option value="keep_old">保留舊值</option>
													<option value="skip">略過</option>
												</select>
											</td>
										</tr>
									{/if}
								{/each}
							</tbody>
						</table>
					</div>
				{/if}

				{#if previewResult.records.some((r) => r.status === 'new')}
					<h3 class="font-semibold mt-4">新增記錄（前 20 筆）</h3>
					<div class="overflow-x-auto">
						<table class="table table-sm">
							<thead>
								<tr><th>日期</th><th>分類</th><th class="text-right">金額</th></tr>
							</thead>
							<tbody>
								{#each previewResult.records.filter((r) => r.status === 'new').slice(0, 20) as pr}
									<tr>
										<td>{pr.record.expense_date}</td>
										<td>{pr.record.raw_category}</td>
										<td class="text-right tabular-nums">{pr.record.amount}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}

				<div class="card-actions mt-4">
					<button class="btn btn-primary btn-sm" onclick={handleCommit} disabled={committing}>
						確認匯入
					</button>
					<button class="btn btn-ghost btn-sm" onclick={reset}>取消</button>
				</div>
			</div>
		</div>
	{:else}
		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<label class="form-control w-full max-w-xs">
					<div class="label"><span class="label-text font-semibold">選擇 CSV 檔案</span></div>
					<input id="csv-file" type="file" accept=".csv" class="file-input file-input-bordered file-input-sm w-full" bind:this={fileInput} />
				</label>

				<label class="form-control w-auto">
					<div class="label"><span class="label-text font-semibold">年份</span></div>
					<input id="year" type="number" min="2000" max="2100" class="input input-bordered input-sm w-24" bind:value={year} />
				</label>

				<div class="mt-4">
					<button class="btn btn-primary btn-sm" onclick={handleUpload} disabled={status === 'uploading' || status === 'previewing'}>
						{#if status === 'uploading'}
							<span class="loading loading-spinner loading-xs"></span> 上傳中...
						{:else if status === 'previewing'}
							<span class="loading loading-spinner loading-xs"></span> 分析中...
						{:else}
							上傳並預覽
						{/if}
					</button>
				</div>

				{#if status === 'error'}
					<div class="alert alert-error text-sm mt-4">{errorMessage}</div>
				{/if}

				{#if uploadResult?.errors?.length}
					<div class="mt-4 space-y-1">
						<h3 class="font-semibold text-sm">訊息</h3>
						{#each uploadResult.errors as err}
							<p class="text-sm {err.severity === 'blocking' ? 'text-error' : err.severity === 'warning' ? 'text-warning' : 'text-base-content/60'}">
								{err.severity}: {err.message}
							</p>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
