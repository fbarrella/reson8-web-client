import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

import { cn } from "@/lib/utils";

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

function DropdownMenuContent({
  className,
  sideOffset = 4,
  align = "end",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  // No Portal: Radix's Popper positioning is `position: fixed` regardless of
  // where the content lives in the DOM, so it still escapes ancestor
  // overflow/clipping — but rendering inline (vs. portaled to document.body)
  // keeps it a DOM descendant of the page's <main> landmark, which a
  // document.body portal would not be (axe: region — "content not contained
  // by landmarks" — flagged a portaled DropdownMenuContent during the P7.5
  // audit).
  return (
    <DropdownMenuPrimitive.Content
      sideOffset={sideOffset}
      align={align}
      className={cn(
        "z-50 min-w-40 overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuItem({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { variant?: "default" | "destructive" }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        "relative flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none select-none",
        "focus:bg-accent focus:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        variant === "destructive" && "text-destructive-text focus:bg-destructive/10 focus:text-destructive-text",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return <DropdownMenuPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator };
