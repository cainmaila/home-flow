<script lang="ts">
	import { formatAmount } from '$lib/utils';

	let {
		matrixMonths,
		matrixRows,
		anomalyThreshold = 0.3
	}: {
		matrixMonths: string[];
		matrixRows: { big_category: string; totals: Record<string, number>; avg: number; vsAvg: number }[];
		anomalyThreshold?: number;
	} = $props();
</script>

{#if matrixRows.length > 0}
	<div class="card bg-base-100 shadow">
		<div class="card-body">
			<h2 class="card-title text-lg">分類月度矩陣</h2>
			<div class="overflow-x-auto">
				<table class="table table-sm">
					<thead>
						<tr>
							<th>大分類</th>
							{#each matrixMonths as m}
								<th class="text-right">{m.slice(5)}</th>
							{/each}
							<th class="text-right">平均</th>
							<th class="text-right">vs 平均</th>
						</tr>
					</thead>
					<tbody>
						{#each matrixRows as row}
							{@const absVs = Math.abs(row.vsAvg)}
							<tr class="hover">
								<td class="font-medium">{row.big_category}</td>
								{#each matrixMonths as m}
									<td class="text-right tabular-nums">{formatAmount(row.totals[m] ?? 0)}</td>
								{/each}
								<td class="text-right tabular-nums text-base-content/60">{formatAmount(row.avg)}</td>
								<td class="text-right tabular-nums">
									<span class={row.vsAvg > 0 ? 'text-error font-semibold' : row.vsAvg < 0 ? 'text-success font-semibold' : ''}>
										{row.vsAvg >= 0 ? '+' : ''}{Math.round(row.vsAvg * 100)}%
										{#if absVs >= anomalyThreshold}⚠{/if}
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr class="font-semibold">
							<td>合計</td>
							{#each matrixMonths as m}
								<td class="text-right tabular-nums">{formatAmount(matrixRows.reduce((s, r) => s + (r.totals[m] ?? 0), 0))}</td>
							{/each}
							<td class="text-right tabular-nums text-base-content/60">{formatAmount(matrixRows.reduce((s, r) => s + r.avg, 0))}</td>
							<td></td>
						</tr>
					</tfoot>
				</table>
			</div>
		</div>
	</div>
{/if}
