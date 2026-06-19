/**
 * Standard category set for Home Flow.
 * Data-Rules §4.2 preset + common categories from sample CSV.
 */
export const STANDARD_CATEGORIES = [
	// Data-Rules §4.2 presets
	'早餐',
	'午餐',
	'晚餐',
	'飲料',
	'交通',
	'醫療',
	'食材',
	'固定支出',
	// Common categories from sample CSV
	'水果',
	'零食',
	'日用品',
	'外出',
	'加油',
	'保險',
	'瓦斯',
	'水',
	'電',
	'貸款',
	'訂閱',
	'彩券'
] as const;

export type StandardCategory = (typeof STANDARD_CATEGORIES)[number];

/** Set for O(1) lookup */
export const STANDARD_CATEGORY_SET = new Set<string>(STANDARD_CATEGORIES);
