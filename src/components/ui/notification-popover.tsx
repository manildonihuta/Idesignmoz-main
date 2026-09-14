"use client";

import React, { useState } from "react";
import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/core";
import { cn } from "@/lib/utils";

export type Notification = {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
};

interface NotificationItemProps {
  notification: Notification;
  index: number;
  onMarkAsRead: (id: string) => void;
  textColor?: string;
  hoverBgColor?: string;
  dotColor?: string;
}

const NotificationItem = ({
  notification,
  index,
  onMarkAsRead,
  textColor = "text-white",
  dotColor = "bg-brand",
  hoverBgColor = "hover:bg-[#ffffff37]",
}: NotificationItemProps) => (
  <motion.div
    initial={{ opacity: 0, x: 20, filter: "blur(10px)" }}
    animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
    transition={{ duration: 0.3, delay: index * 0.08 }}
    key={notification.id}
    className={cn("cursor-pointer p-4 transition-colors", hoverBgColor)}
    onClick={() => onMarkAsRead(notification.id)}
  >
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-2">
        {!notification.read && <span className={cn("h-1 w-1 rounded-full", dotColor)} />}
        <h4 className={cn("text-sm font-medium", textColor)}>{notification.title}</h4>
      </div>
      <span className={cn("text-xs opacity-80", textColor)}>
        {notification.timestamp.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })}
      </span>
    </div>
    <p className={cn("mt-1 text-xs opacity-70", textColor)}>{notification.description}</p>
  </motion.div>
);

interface NotificationListProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  textColor?: string;
  hoverBgColor?: string;
  dividerColor?: string;
}

const NotificationList = ({
  notifications,
  onMarkAsRead,
  textColor,
  hoverBgColor,
  dividerColor = "divide-[#ffffff1A]",
}: NotificationListProps) => (
  <div className={cn("divide-y", dividerColor)}>
    {notifications.map((notification, index) => (
      <NotificationItem
        key={notification.id}
        notification={notification}
        index={index}
        onMarkAsRead={onMarkAsRead}
        textColor={textColor}
        hoverBgColor={hoverBgColor}
      />
    ))}
  </div>
);

interface NotificationPopoverProps {
  notifications?: Notification[];
  onNotificationsChange?: (notifications: Notification[]) => void;
  buttonClassName?: string;
  popoverClassName?: string;
  textColor?: string;
  hoverBgColor?: string;
  dividerColor?: string;
  headerBorderColor?: string;
  title?: string;
  markAllLabel?: string;
  emptyText?: string;
}

export const NotificationPopover = ({
  notifications: initialNotifications = [],
  onNotificationsChange,
  buttonClassName = "shadow-[0_0_20px_rgba(0,0,0,0.2)]",
  popoverClassName = "bg-[#111111E6]",
  textColor = "text-white",
  hoverBgColor = "hover:bg-[#ffffff37]",
  dividerColor = "divide-[#ffffff1A]",
  headerBorderColor = "border-[#ffffff1A]",
  title = "Notificações",
  markAllLabel = "Marcar todas como lidas",
  emptyText = "Sem notificações.",
}: NotificationPopoverProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [prevInitial, setPrevInitial] = useState(initialNotifications);

  if (prevInitial !== initialNotifications) {
    setPrevInitial(initialNotifications);
    setNotifications(initialNotifications);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    onNotificationsChange?.(updated);
  };

  const markAsRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    setNotifications(updated);
    onNotificationsChange?.(updated);
  };

  return (
    <div className={cn("relative", textColor)}>
      <Button
        variant="glass"
        size="icon"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={title}
        aria-expanded={isOpen}
        className={cn("relative", buttonClassName)}
      >
        <Bell size={16} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="dialog"
            aria-label={title}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "absolute right-0 z-50 mt-2 max-h-[400px] w-80 overflow-y-auto rounded-xl border border-[#ffffff1A] shadow-2xl backdrop-blur-xl",
              popoverClassName,
            )}
          >
            <div className={cn("flex items-center justify-between border-b p-4", headerBorderColor)}>
              <h3 className={cn("text-sm font-medium", textColor)}>{title}</h3>
              <Button
                variant="ghostGlass"
                size="sm"
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                className={cn("text-xs", hoverBgColor)}
              >
                {markAllLabel}
              </Button>
            </div>

            {notifications.length === 0 ? (
              <p className={cn("px-4 py-8 text-center text-sm opacity-70", textColor)}>{emptyText}</p>
            ) : (
              <NotificationList
                notifications={notifications}
                onMarkAsRead={markAsRead}
                textColor={textColor}
                hoverBgColor={hoverBgColor}
                dividerColor={dividerColor}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};