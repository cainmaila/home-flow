<script lang="ts">
	const MAX_SIZE = 10 * 1024 * 1024; // 10MB
	const currentYear = new Date().getFullYear();

	let fileInput: HTMLInputElement | undefined = $state();
	let year: number = $state(currentYear);
	let status: 'idle' | 'uploading' | 'done' | 'error' = $state('idle');
	let errorMessage: string = $state('');
	let result: {
		ok: boolean;
		recordCount: number;
		records: { expense_date: string; raw_category: string; amount: number }[];
		errors: { severity: string; message: string }[];
	} | null = $state(null);

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
		result = null;

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

			result = await res.json();
			status = 'done';
		} catch (e) {
			errorMessage = '網路錯誤，請再試一次';
			status = 'error';
		}
	}
</script>

<div class="import-page">
	<h1>匯入 CSV</h1>

	<div class="form-group">
		<label for="csv-file">選擇 CSV 檔案</label>
		<input id="csv-file" type="file" accept=".csv" bind:this={fileInput} />
	</div>

	<div class="form-group">
		<label for="year">年份</label>
		<input id="year" type="number" min="2000" max="2100" bind:value={year} />
	</div>

	<button onclick={handleUpload} disabled={status === 'uploading'}>
		{status === 'uploading' ? '上傳中...' : '上傳'}
	</button>

	{#if status === 'error'}
		<p class="error">{errorMessage}</p>
	{/if}

	{#if result}
		<div class="result">
			<h2>解析結果</h2>
			<p>共 {result.recordCount} 筆有效記錄</p>

			{#if result.errors.length > 0}
				<h3>訊息</h3>
				<ul class="errors">
					{#each result.errors as err}
						<li class="severity-{err.severity}">{err.severity}: {err.message}</li>
					{/each}
				</ul>
			{/if}

			{#if result.records.length > 0}
				<h3>預覽（前 20 筆）</h3>
				<table>
					<thead>
						<tr>
							<th>日期</th>
							<th>分類</th>
							<th>金額</th>
						</tr>
					</thead>
					<tbody>
						{#each result.records.slice(0, 20) as rec}
							<tr>
								<td>{rec.expense_date}</td>
								<td>{rec.raw_category}</td>
								<td>{rec.amount}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	{/if}
</div>

<style>
	.import-page {
		max-width: 640px;
		margin: 40px auto;
		padding: 0 1rem;
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

	.error {
		color: #c00;
		margin-top: 1rem;
	}

	.result {
		margin-top: 2rem;
	}

	.errors {
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
	}

	th {
		background: #f5f5f5;
	}
</style>
