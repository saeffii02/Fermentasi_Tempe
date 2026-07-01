// frontend/src/components/NotificationsPanel/index.tsx

import { Slideover } from "@/components/Base/Headless";
import Button from "@/components/Base/Button";
import Lucide, { icons } from "@/components/Base/Lucide";
import { useState, useEffect, useCallback } from "react";
import { iotService, setupWebSocket } from "@/services/iotService";
import clsx from "clsx";

// 🔥 Import type untuk ikon
type LucideIconName = keyof typeof icons;

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  metadata: any;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

interface MainProps {
  notificationsPanel: boolean;
  setNotificationsPanel: (val: boolean) => void;
}

function Main(props: MainProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);
  const [deletingRead, setDeletingRead] = useState(false);

  // 🔥 PERBAIKI - Mapping ikon dengan type yang aman
  const getTypeIcon = (type: string): LucideIconName => {
    const iconMap: Record<string, LucideIconName> = {
      'SENSOR_WARNING': 'Thermometer',
      'SENSOR_CRITICAL': 'TriangleAlert',
      'BATCH_STARTED': 'Play',
      'BATCH_COMPLETED': 'CircleCheck',
      'BATCH_PHASE_CHANGE': 'RefreshCw',
      'ACTUATOR_CHANGE': 'Zap',
      'MODE_CHANGE': 'Cpu',
      'SYSTEM_ALERT': 'Bell',
      'CONNECTION_STATUS': 'Wifi',
      'CRITICAL_STATUS': 'TriangleAlert',
    };
    return iconMap[type] || 'Bell';
  };

  // 🔥 PERBAIKI - getSeverityStyles dengan type yang aman
  const getSeverityStyles = (severity: string): { bg: string; text: string; icon: LucideIconName } => {
    switch (severity) {
      case 'success':
        return { bg: 'bg-green-100', text: 'text-green-600', icon: 'CircleCheck' };
      case 'warning':
        return { bg: 'bg-yellow-100', text: 'text-yellow-600', icon: 'TriangleAlert' };
      case 'error':
        return { bg: 'bg-red-100', text: 'text-red-600', icon: 'TriangleAlert' };
      default:
        return { bg: 'bg-blue-100', text: 'text-blue-600', icon: 'Info' };
    }
  };

  const loadNotifications = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      const newOffset = reset ? 0 : offset;
      console.log(`📥 Loading notifications: reset=${reset}, offset=${newOffset}`);
      
      const data = await iotService.getNotifications(20, newOffset);
      console.log('📥 Notifications received:', data);
      
      if (reset) {
        setNotifications(data.notifications || []);
        setOffset(20);
      } else {
        setNotifications(prev => [...prev, ...(data.notifications || [])]);
        setOffset(newOffset + (data.notifications?.length || 0));
      }
      setUnreadCount(data.unreadCount || 0);
      setHasMore(data.hasMore || false);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [offset]);

  const loadUnreadCount = useCallback(async () => {
    try {
      const data = await iotService.getUnreadCount();
      console.log('📊 Unread count:', data);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error('Failed to load unread count:', err);
    }
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await iotService.markNotificationRead(id);
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === id ? { ...notif, isRead: true, readAt: new Date().toISOString() } : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      setMarkingAll(true);
      await iotService.markAllNotificationsRead();
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, isRead: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await iotService.deleteNotification(id);
      const deletedNotif = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(notif => notif.id !== id));
      if (deletedNotif && !deletedNotif.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const deleteAllRead = async () => {
    try {
      setDeletingRead(true);
      await iotService.deleteAllReadNotifications();
      setNotifications(prev => prev.filter(notif => !notif.isRead));
      const newUnreadCount = notifications.filter(n => !n.isRead).length;
      setUnreadCount(newUnreadCount);
    } catch (err) {
      console.error('Failed to delete read notifications:', err);
    } finally {
      setDeletingRead(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  useEffect(() => {
    if (props.notificationsPanel) {
      console.log('🔔 Notifications panel opened, loading data...');
      loadNotifications(true);
    }
  }, [props.notificationsPanel, loadNotifications]);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(() => {
      loadUnreadCount();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  useEffect(() => {
    const cleanup = setupWebSocket((data: any) => {
      console.log('📨 WebSocket data received:', data);
      
      if (data.type === 'notification:new') {
        setNotifications(prev => [data, ...prev]);
        setUnreadCount(prev => prev + 1);
      } else if (data.type === 'notification:read') {
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === data.id ? { ...notif, isRead: true, readAt: new Date().toISOString() } : notif
          )
        );
        loadUnreadCount();
      } else if (data.type === 'notification:deleted') {
        setNotifications(prev => prev.filter(notif => notif.id !== data.id));
      } else if (data.type === 'notification:all-read') {
        setNotifications(prev =>
          prev.map(notif => ({ ...notif, isRead: true, readAt: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [loadUnreadCount]);

  return (
    <div>
      <Slideover
        open={props.notificationsPanel}
        onClose={() => {
          props.setNotificationsPanel(false);
        }}
      >
        <Slideover.Panel className="w-96 rounded-[0.75rem_0_0_0.75rem/1.1rem_0_0_1.1rem]">
          <a
            href=""
            className="focus:outline-none hover:bg-white/10 bg-white/5 transition-all hover:rotate-180 absolute inset-y-0 left-0 right-auto flex items-center justify-center my-auto -ml-[60px] sm:-ml-[105px] border rounded-full text-white/90 w-8 h-8 sm:w-14 sm:h-14 border-white/90 hover:scale-105 dark:bg-darkmode-800/40 dark:border-darkmode-800/20"
            onClick={(e) => {
              e.preventDefault();
              props.setNotificationsPanel(false);
            }}
          >
            <Lucide icon="X" className="w-8 h-8 stroke-[1]" />
          </a>
          <Slideover.Title className="px-6 py-5">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Lucide icon="Bell" className="w-5 h-5" />
                <h2 className="text-base font-medium">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="ml-2 bg-primary text-white text-xs px-2 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={markAllAsRead}
                  disabled={unreadCount === 0 || markingAll}
                  className="text-xs"
                >
                  {markingAll ? (
                    <Lucide icon="Loader" className="w-3 h-3 animate-spin" />
                  ) : (
                    <Lucide icon="Check" className="w-3 h-3 mr-1" />
                  )}
                  Mark all read
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={deleteAllRead}
                  disabled={deletingRead}
                  className="text-xs"
                >
                  {deletingRead ? (
                    <Lucide icon="Loader" className="w-3 h-3 animate-spin" />
                  ) : (
                    <Lucide icon="Trash2" className="w-3 h-3 mr-1" />
                  )}
                  Clear read
                </Button>
              </div>
            </div>
          </Slideover.Title>
          <Slideover.Description className="p-0">
            <div className="flex flex-col h-[calc(100vh-120px)]">
              <div className="flex-1 overflow-y-auto">
                {loading && notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Lucide icon="Loader" className="w-8 h-8 animate-spin text-primary" />
                    <p className="mt-3 text-sm text-slate-500">Loading notifications...</p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <Lucide icon="BellOff" className="w-12 h-12 mb-3" />
                    <p className="text-sm">No notifications</p>
                    <p className="text-xs">New notifications will appear here</p>
                  </div>
                ) : (
                  <div className="flex flex-col p-3 gap-2">
                    {notifications.map((notification) => {
                      const severityStyles = getSeverityStyles(notification.severity);
                      const typeIcon = getTypeIcon(notification.type);
                      
                      return (
                        <div
                          key={notification.id}
                          className={clsx(
                            "relative p-4 rounded-xl transition-all cursor-pointer",
                            !notification.isRead ? "bg-primary/5 border-l-4 border-primary" : "bg-slate-50 hover:bg-slate-100",
                            "dark:bg-darkmode-400 dark:hover:bg-darkmode-300"
                          )}
                          onClick={() => !notification.isRead && markAsRead(notification.id)}
                        >
                          {!notification.isRead && (
                            <div className="absolute top-3 right-3 w-2 h-2 bg-primary rounded-full"></div>
                          )}
                          
                          <div className="flex gap-3">
                            <div className={clsx("flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center", severityStyles.bg)}>
                              {/* 🔥 SEKARANG typeIcon sudah memiliki type yang benar */}
                              <Lucide icon={typeIcon} className={clsx("w-5 h-5", severityStyles.text)} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-medium text-sm">{notification.title}</h4>
                                <span className={clsx("text-xs px-2 py-0.5 rounded-full", severityStyles.bg, severityStyles.text)}>
                                  {notification.type.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                {notification.message}
                              </p>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-slate-400">
                                  {formatTime(notification.createdAt)}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNotification(notification.id);
                                  }}
                                  className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                >
                                  <Lucide icon="X" className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {hasMore && (
                      <div className="text-center py-3">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => loadNotifications(false)}
                          disabled={loading}
                          className="text-xs"
                        >
                          {loading ? (
                            <Lucide icon="Loader" className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <Lucide icon="ChevronDown" className="w-3 h-3 mr-1" />
                          )}
                          Load more
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Slideover.Description>
        </Slideover.Panel>
      </Slideover>
    </div>
  );
}

export default Main;