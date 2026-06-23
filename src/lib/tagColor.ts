export type TagColor = 'orange' | 'green' | 'teal' | 'gray' | 'purple' | 'red' | 'blue';
const TAG_COLORS: TagColor[] = ['orange', 'green', 'teal', 'gray', 'purple', 'red', 'blue'];

const OVERRIDE: Record<string, TagColor> = {
	'現金': 'teal'
};

export function tagColor(name: string): TagColor {
	if (OVERRIDE[name]) return OVERRIDE[name];
	let h = 0;
	for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
	return TAG_COLORS[h % TAG_COLORS.length];
}
