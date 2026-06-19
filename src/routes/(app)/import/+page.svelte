<script lang="ts">
	const MAX_SIZE = 10 * 1024 * 1024; // 10MB
	const currentYear = new Date().getFullYear();
	const HOUSEHOLD_ID = 'default';

	let fileInput: HTMLInputElement | undefined = $state();
	let year: number = $state(currentYear);
	let status: 'idle' | 'uploading' | 'previewing' | 'previewed' | 'committing' | 'committed' | 'error' = $state('idle');
	let committing: boolean = $state(false);
	let errorMessage: string = $state('');

	// Upload result (parsed records from CSV)
	let uploadResult: {
		ok: boolean;
		recordCount: number;
		records: { expense_date: string; raw_category: string; amount: number }[];
		errors: { severity: string; message: string }[];
	} | null = $state(null);

	// Preview result
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

	// Commit result
	let commitResult: {
		importId: string;
		inserted: number;
		duplicates: number;
		updated: number;
		skipped: number;
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

			// Automatically run preview
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

<div class="import-page">
	<h1>匯入 CSV</h1>

	{#if status === 'committed' && commitResult}
		<div class="commit-result">
			<h2>匯入完成</h2>
			<table class="summary-table">
				<tbody>
					<tr><td>新增</td><td>{commitResult.inserted} 筆</td></tr>
					<tr><td>重複略過</td><td>{commitResult.duplicates} 筆</td></tr>
					<tr><td>更新</td><td>{commitResult.updated} 筆</td></tr>
					<tr><td>略過</td><td>{commitResult.skipped} 筆</td></tr>
				</tbody>
			</table>
			<div class="actions">
				<button onclick={reset}>匯入其他檔案</button>
				<a href="/import/history">查看匯入歷程</a>
			</div>
		</div>
	{:else if status === 'previewed' && previewResult}
		<div class="preview-result">
			<h2>預覽結果</h2>
			<table class="summary-table">
				<tbody>
					<tr><td>解析筆數</td><td>{previewResult.summary.parsed}</td></tr>
					<tr><td>新增</td><td>{previewResult.summary.newRecords}</td></tr>
					<tr><td>重複</td><td>{previewResult.summary.duplicates}</td></tr>
					<tr><td>更新候選</td><td>{previewResult.summary.updates}</td></tr>
				</tbody>
			</table>

			{#if previewResult.records.some((r) => r.status === 'update')}
				<h3>更新候選</h3>
				<div class="table-scroll">
					<table>
						<thead>
							<tr>
								<th>日期</th>
								<th>分類</th>
								<th>舊金額</th>
								<th>新金額</th>
								<th>處理方式</th>
							</tr>
						</thead>
						<tbody>
							{#each previewResult.records as pr, i}
								{#if pr.status === 'update'}
									<tr>
										<td>{pr.record.expense_date}</td>
										<td>{pr.record.raw_category}</td>
										<td>{pr.existingAmount}</td>
										<td>{pr.record.amount}</td>
										<td>
											<select
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
				<h3>新增記錄（前 20 筆）</h3>
				<table>
					<thead>
						<tr><th>日期</th><th>分類</th><th>金額</th></tr>
					</thead>
					<tbody>
						{#each previewResult.records.filter((r) => r.status === 'new').slice(0, 20) as pr}
							<tr>
								<td>{pr.record.expense_date}</td>
								<td>{pr.record.raw_category}</td>
								<td>{pr.record.amount}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}

			<div class="actions">
				<button onclick={handleCommit} disabled={committing}>
					確認匯入
				</button>
				<button onclick={reset} class="secondary">取消</button>
			</div>
		</div>
	{:else}
		<div class="form-group">
			<label for="csv-file">選擇 CSV 檔案</label>
			<input id="csv-file" type="file" accept=".csv" bind:this={fileInput} />
		</div>

		<div class="form-group">
			<label for="year">年份</label>
			<input id="year" type="number" min="2000" max="2100" bind:value={year} />
		</div>

		<button onclick={handleUpload} disabled={status === 'uploading' || status === 'previewing'}>
			{#if status === 'uploading'}
				上傳中...
			{:else if status === 'previewing'}
				分析中...
			{:else}
				上傳並預覽
			{/if}
		</button>

		{#if status === 'error'}
			<p class="error">{errorMessage}</p>
		{/if}

		{#if uploadResult?.errors?.length}
			<div class="warnings">
				<h3>訊息</h3>
				<ul>
					{#each uploadResult.errors as err}
						<li class="severity-{err.severity}">{err.severity}: {err.message}</li>
					{/each}
				</ul>
			</div>
		{/if}
	{/if}

</div>

<style>
	.import-page {
		max-width: 700px;
		margin: 0 auto;
		font-family: system-ui, sans-serif;
	}

	.form-group {
		margin-bottom: 1rem;
	}

	label {
		display: block;
		margin-bottom: 0.25rem;
		font-weight: 600;
	}

	input[type='number'] {
		width: 6rem;
		padding: 0.3rem 0.5rem;
	}

	button {
		padding: 0.5rem 1.5rem;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	button.secondary {
		background: #eee;
		border: 1px solid #ccc;
		margin-left: 0.5rem;
	}

	.error {
		color: #c00;
		margin-top: 1rem;
	}

	.warnings {
		margin-top: 1rem;
	}

	.warnings ul {
		list-style: none;
		padding: 0;
	}

	.severity-blocking {
		color: #c00;
	}

	.severity-warning {
		color: #b86e00;
	}

	.severity-info {
		color: #666;
	}

	.summary-table {
		margin: 0.5rem 0 1rem;
		border-collapse: collapse;
	}

	.summary-table td {
		padding: 0.25rem 1rem 0.25rem 0;
	}

	.summary-table td:last-child {
		font-weight: 600;
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
		padding: 0.3rem 0.5rem;
		text-align: left;
		white-space: nowrap;
	}

	th {
		background: #f5f5f5;
	}

	select {
		padding: 0.2rem;
	}

	.actions {
		margin-top: 1.5rem;
	}

	.commit-result {
		margin-top: 1rem;
	}
</style>
