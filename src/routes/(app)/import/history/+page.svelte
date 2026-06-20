<script lang="ts">
	import Icon from '@iconify/svelte';
	import { icons } from '$lib/icons';
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

<div class="space-y-6">
	<div class="flex items-center justify-between flex-wrap gap-4">
		<h1 class="text-2xl font-bold">匯入歷程</h1>
		<a href="/import" class="btn btn-ghost btn-sm gap-1"><Icon icon={icons.back} class="text-base" />返回匯入</a>
	</div>

	{#if loading}
		<div class="flex justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if errorMessage}
		<div class="alert alert-error">{errorMessage}</div>
	{:else if imports.length === 0}
		<div class="card bg-base-100 shadow">
			<div class="card-body text-center">
				<p class="text-base-content/50">尚無匯入記錄。</p>
			</div>
		</div>
	{:else}
		<div class="card bg-base-100 shadow">
			<div class="card-body p-0">
				<div class="overflow-x-auto">
					<table class="table table-sm">
						<thead>
							<tr>
								<th>時間</th>
								<th>匯入者</th>
								<th>檔案</th>
								<th>狀態</th>
								<th class="text-right">解析</th>
								<th class="text-right">新增</th>
								<th class="text-right">重複</th>
								<th class="text-right">更新</th>
								<th class="text-right">略過</th>
							</tr>
						</thead>
						<tbody>
							{#each imports as imp}
								<tr class="hover">
									<td class="whitespace-nowrap">{formatTime(imp.committed_at ?? imp.created_at)}</td>
									<td>{imp.uploaded_by_name ?? imp.uploaded_by_email ?? '-'}</td>
									<td>{imp.filename}</td>
									<td>
										<span class="badge badge-sm {imp.status === 'committed' ? 'badge-success' : imp.status === 'failed' ? 'badge-error' : 'badge-ghost'}">
											{statusLabels[imp.status] ?? imp.status}
										</span>
									</td>
									<td class="text-right tabular-nums">{imp.parsed_rows}</td>
									<td class="text-right tabular-nums">{imp.inserted_rows}</td>
									<td class="text-right tabular-nums">{imp.duplicate_rows}</td>
									<td class="text-right tabular-nums">{imp.updated_rows}</td>
									<td class="text-right tabular-nums">{imp.skipped_rows}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	{/if}
</div>
