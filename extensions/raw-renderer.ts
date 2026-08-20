import type { AssistantMessage } from "@earendil-works/pi-ai";
import { stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export interface RawModeArgumentResult {
	enabled?: boolean;
	error?: string;
}

export function resolveRawModeArgument(
	args: string,
	currentValue: boolean,
): RawModeArgumentResult {
	const requested = args.trim().toLowerCase();
	if (!requested) return { enabled: !currentValue };
	if (requested === "on") return { enabled: true };
	if (requested === "off") return { enabled: false };
	return { error: "Usage: /raw [on|off]" };
}

function sanitizeRawText(text: string): string {
	return stripTerminalSequences(text)
		.replace(/\r\n?/g, "\n")
		.replace(/\t/g, "   ")
		.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, "");
}

/** Render logical source lines without Markdown interpretation or added padding. */
export function wrapRawText(text: string, width: number): string[] {
	const availableWidth = Math.max(1, width);
	const output: string[] = [];

	for (const line of sanitizeRawText(text).split("\n")) {
		const lineStart = output.length;
		let current = "";
		let currentWidth = 0;

		for (const { segment } of graphemeSegmenter.segment(line)) {
			const segmentWidth = visibleWidth(segment);
			if (segmentWidth > availableWidth) {
				if (current) output.push(current);
				output.push("?");
				current = "";
				currentWidth = 0;
				continue;
			}
			if (currentWidth > 0 && currentWidth + segmentWidth > availableWidth) {
				output.push(current);
				current = "";
				currentWidth = 0;
			}
			current += segment;
			currentWidth += segmentWidth;
		}

		if (current || output.length === lineStart) output.push(current);
	}

	return output;
}

export function renderRawAssistant(message: AssistantMessage, width: number): string[] {
	const sections = message.content
		.filter((content) => content.type === "text" && content.text.trim())
		.map((content) => (content.type === "text" ? content.text : ""));

	const hasToolCalls = message.content.some((content) => content.type === "toolCall");
	if (message.stopReason === "length") {
		sections.push("Response was truncated before completion.");
	} else if (!hasToolCalls && message.stopReason === "aborted") {
		sections.push(
			message.errorMessage && message.errorMessage !== "Request was aborted"
				? message.errorMessage
				: "Operation aborted",
		);
	} else if (!hasToolCalls && message.stopReason === "error") {
		sections.push(`Error: ${message.errorMessage || "Unknown error"}`);
	}

	return sections.length > 0 ? wrapRawText(sections.join("\n"), width) : [];
}
