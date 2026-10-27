import { Eye } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
  followerDisplayName,
  isFollowingBug,
} from "../../../shared/bug-follow";
import type { BugFollower, BugzillaUser } from "../../../shared/types";

interface FollowMenuProps {
  followers: BugFollower[];
  currentUser?: BugzillaUser;
  disabled?: boolean;
  pending?: boolean;
  onStartFollowing: () => void;
  onStopFollowing: () => void;
}

export function FollowMenu({
  followers,
  currentUser,
  disabled = false,
  pending = false,
  onStartFollowing,
  onStopFollowing,
}: FollowMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const following = isFollowingBug(followers, currentUser);
  const canToggle = Boolean(currentUser?.name.trim()) && !disabled && !pending;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="follow-menu" ref={rootRef}>
      <button
        type="button"
        className={
          following
            ? "follow-button secondary-button follow-button-active"
            : "follow-button secondary-button"
        }
        aria-label={following ? "Following this bug" : "Follow this bug"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={following ? "Following" : "Follow"}
        disabled={disabled || pending}
        onClick={() => setOpen((current) => !current)}
      >
        <Eye size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="follow-menu-panel" id={menuId} role="menu">
          <button
            type="button"
            role="menuitem"
            className="follow-menu-action"
            disabled={!canToggle}
            onClick={() => {
              setOpen(false);
              if (!canToggle) return;
              if (following) onStopFollowing();
              else onStartFollowing();
            }}
          >
            {pending
              ? following
                ? "Stopping…"
                : "Starting…"
              : following
                ? "Stop Following"
                : "Start Following"}
          </button>
          <div className="follow-menu-divider" role="separator" />
          {followers.length === 0 ? (
            <p className="follow-menu-empty">No one is following yet</p>
          ) : (
            <ul className="follow-menu-list" aria-label="People following this bug">
              {followers.map((follower) => (
                <li key={follower.name} className="follow-menu-follower">
                  {followerDisplayName(follower)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
