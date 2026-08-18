import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useChannelTreeStore } from "@/stores/channelTreeStore";
import { createChannel } from "@/services/channelService";
import { ChannelType } from "@/types/reson8-protocol";

const createChannelSchema = z.object({
  name: z.string().min(1, "Name is required").max(64, "Name must be 64 characters or fewer"),
  type: z.nativeEnum(ChannelType),
  parentId: z.string(),
  isNsfw: z.boolean(),
});

type CreateChannelValues = z.infer<typeof createChannelSchema>;

export function CreateChannelDialog({
  open,
  onOpenChange,
  defaultParentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultParentId?: string | null;
}) {
  const nodesById = useChannelTreeStore((s) => s.nodesById);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateChannelValues>({
    resolver: zodResolver(createChannelSchema),
    defaultValues: {
      name: "",
      type: ChannelType.TEXT,
      parentId: defaultParentId ?? "",
      isNsfw: false,
    },
  });

  const type = watch("type");

  const onSubmit = async (values: CreateChannelValues) => {
    setSubmitting(true);
    const success = await createChannel({
      name: values.name,
      type: values.type,
      parentId: values.parentId || null,
      isNsfw: values.type === ChannelType.TEXT ? values.isNsfw : false,
    });
    setSubmitting(false);
    if (success) {
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="flex flex-col">
          <DialogHeader>
            <DialogTitle>Create Channel</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 overflow-y-auto p-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="channel-name">Name</Label>
              <Input id="channel-name" aria-invalid={!!errors.name} {...register("name")} />
              {errors.name && <p className="text-sm text-destructive-text">{errors.name.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Type</span>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={field.value === ChannelType.TEXT ? "default" : "outline"}
                      size="sm"
                      onClick={() => field.onChange(ChannelType.TEXT)}
                    >
                      Text
                    </Button>
                    <Button
                      type="button"
                      variant={field.value === ChannelType.VOICE ? "default" : "outline"}
                      size="sm"
                      onClick={() => field.onChange(ChannelType.VOICE)}
                    >
                      Voice
                    </Button>
                  </div>
                )}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="channel-parent">Parent category</Label>
              <select
                id="channel-parent"
                className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                {...register("parentId")}
              >
                <option value="">No parent (top-level)</option>
                {[...nodesById.values()].map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.name}
                  </option>
                ))}
              </select>
            </div>

            {type === ChannelType.TEXT && (
              <label className="flex min-h-11 items-center justify-between gap-4">
                <span className="text-sm font-medium text-foreground">NSFW</span>
                <input type="checkbox" className="size-5" {...register("isNsfw")} />
              </label>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
