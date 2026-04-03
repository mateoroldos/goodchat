<script lang="ts">
	import { cn } from "$lib/utils";
	import { MessageBranchClass, setMessageBranchContext } from "./message-context.svelte.js";
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	interface Props extends HTMLAttributes<HTMLDivElement> {
		defaultBranch?: number;
		onBranchChange?: (branchIndex: number) => void;
		class?: string;
		children: Snippet;
	}

	let {
		defaultBranch = 0,
		onBranchChange,
		class: className,
		children,
		...restProps
	}: Props = $props();

	// Create the branch context class
	const branchContext = new MessageBranchClass();

	// Set up the context
	setMessageBranchContext(branchContext);

	$effect.pre(() => {
		branchContext.onBranchChange = onBranchChange;
	});

	$effect.pre(() => {
		branchContext.currentBranch = defaultBranch;
	});
</script>

<div class={cn("grid w-full gap-2 [&>div]:pb-0", className)} {...restProps}>
	{@render children()}
</div>
