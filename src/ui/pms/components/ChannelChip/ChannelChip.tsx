import type { ChannelId } from "@/core";
import { cx } from "@/shared";
import { ChannelIcon } from "@/ui/media";
import "./channel-chip.css";

interface ChannelChipProps {
  channel: ChannelId;
  name: string;
  /** icon: 아이콘만 (이름은 툴팁) */
  variant?: "full" | "icon";
  className?: string;
}

export function ChannelChip({ channel, name, variant = "full", className }: ChannelChipProps) {
  return (
    <span className={cx("pm-chan", variant === "icon" && "pm-chan--icon", className)} title={name}>
      <ChannelIcon platform={channel} alt="" className="pm-chan__icon" />
      {variant === "full" ? <span className="pm-chan__name">{name}</span> : <span className="pm-sr">{name}</span>}
    </span>
  );
}
