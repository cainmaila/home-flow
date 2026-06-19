<script lang="ts">
	interface ImportRecord {
		id: string;
		filename: string;
		status: string;
		parsed_rows: number;
		inserted_rows: number;
		duplicate_rows: number;
		updated_rows: number;
		skipped_rows: number;
		warning_rows: number;
		created_at: string;
		committed_at: string | null;
		uploaded_by_email: string | null;
		uploaded_by_name: string | null;
	}

	let imports: ImportRecord[] = $state([]);
	let loading: boolean = $state(true);
	let errorMessage: string = $state('');

	async function loadHistory() {
		loading = true;
		errorMessage = '';
		try {
			const res = await fetch('/api/import/history');
			if (!res.ok) {
				errorMessage = `載入失敗 (${res.status})`;
				return;
			}
			imports = await res.json();
		} catch {
			errorMessage = '網路錯誤';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadHistory();
	});

	function formatTime(iso: string | null): string {
		if (!iso) return '-';
		return new Date(iso + 'Z').toLocaleString('zh-TW');
	}

	const statusLabels: Record<string, string> = {
		uploaded: '已上傳',
		previewed: '預覽中',
		committed: '已匯入',
		failed: '失敗'
	};
</script>

<div class="history-page">
	<h1>匯入歷程</h1>

	<p class="nav-link"><a href="/import">返回匯入</a></p>

	{#if loading}
		<p>載入中...</p>
	{:else if errorMessage}
		<p class="error">{errorMessage}</p>
	{:else if imports.length === 0}
		<p>尚無匯入記錄。</p>
	{:else}
		<table>
			<thead>
				<tr>
					<th>時間</th>
					<th>匯入者</th>
					<th>檔案</th>
					<th>狀態</th>
					<th>解析</th>
					<th>新增</th>
					<th>重複</th>
					<th>更新</th>
					<th>略過</th>
				</tr>
			</thead>
			<tbody>
				{#each imports as imp}
					<tr>
						<td>{formatTime(imp.committed_at ?? imp.created_at)}</td>
						<td>{imp.uploaded_by_name ?? imp.uploaded_by_email ?? '-'}</td>
						<td>{imp.filename}</td>
						<td>{statusLabels[imp.status] ?? imp.status}</td>
						<td>{imp.parsed_rows}</td>
						<td>{imp.inserted_rows}</td>
						<td>{imp.duplicate_rows}</td>
						<td>{imp.updated_rows}</td>
						<td>{imp.skipped_rows}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

<style>
	.history-page {
		max-width: 900px;
		margin: 40px auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
	}

	.error {
		color: #c00;
	}

	.nav-link {
		font-size: 0.9rem;
		margin-bottom: 1rem;
	}

	.nav-link a {
		color: #0066cc;
	}

	table {
		width: 100%;
		border-collapse: collapse;
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

	td {
		font-size: 0.85rem;
	}
</style>
