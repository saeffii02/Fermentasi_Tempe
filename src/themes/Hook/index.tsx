import "@/assets/css/vendors/simplebar.css";
import "@/assets/css/themes/hook.css";
import { Transition } from "react-transition-group";
import Breadcrumb from "@/components/Base/Breadcrumb";
import { useState, useEffect, createRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { selectSideMenu } from "@/stores/sideMenuSlice";
import {
  selectCompactMenu,
  setCompactMenu as setCompactMenuStore,
} from "@/stores/compactMenuSlice";
import { useAppDispatch, useAppSelector } from "@/stores/hooks";
import { FormattedMenu, linkTo, nestedMenu, enter, leave } from "./side-menu";
import Lucide from "@/components/Base/Lucide";
import users from "@/fakers/users";
import clsx from "clsx";
import SimpleBar from "simplebar";
import { Menu } from "@/components/Base/Headless";
import SwitchAccount from "@/components/SwitchAccount";
import NotificationsPanel from "@/components/NotificationsPanel";
import { iotService, setupWebSocket } from "@/services/iotService"; 


// Mapping path ke breadcrumb items - perhatikan huruf besar/kecil sesuai router
const getBreadcrumbItems = (pathname: string): { label: string; path: string }[] => {
  const normalizedPath = pathname.toLowerCase().replace(/^\/|\/$/g, '');
  const pathParts = normalizedPath.split('/').filter(Boolean);
  
  let mainPath = normalizedPath;
  if (pathParts.length >= 1 && pathParts[0] === 'dashboard') {
    if (pathParts.length === 1) {
      mainPath = 'dashboard';
    } else {
      mainPath = pathParts.slice(1).join('/');
    }
  }
  
  const breadcrumbMap: Record<string, { label: string; path: string }[]> = {
    'dashboard': [
      { label: 'App', path: '/' },
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Monitoring', path: '/dashboard' }
    ],
    'actuator-control': [
      { label: 'App', path: '/' },
      { label: 'Control', path: '/dashboard/Actuator-Control' },
      { label: 'Actuator & Fuzzy Control', path: '/dashboard/Actuator-Control' }
    ],
    'history': [
      { label: 'App', path: '/' },
      { label: 'Data', path: '/dashboard/history' },
      { label: 'Logging & Riwayat', path: '/dashboard/history' }
    ],
    'decision-matrix': [
      { label: 'App', path: '/' },
      { label: 'Fuzzy', path: '/dashboard/decision-matrix' },
      { label: 'Decision Matrix', path: '/dashboard/decision-matrix' }
    ],
    'active-batch': [
      { label: 'App', path: '/' },
      { label: 'Batch', path: '/dashboard/active-batch' },
      { label: 'Active Batch Monitoring', path: '/dashboard/active-batch' }
    ],
  };

  for (const [path, items] of Object.entries(breadcrumbMap)) {
    if (mainPath === path || mainPath.startsWith(path + '/')) {
      return items;
    }
  }

  if (pathParts.length > 0) {
    const lastPart = pathParts[pathParts.length - 1];
    const formattedLabel = lastPart
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    return [
      { label: 'App', path: '/' },
      { label: 'Pages', path: '#' },
      { label: formattedLabel || 'Unknown', path: '#' }
    ];
  }

  return [
    { label: 'App', path: '/' },
    { label: 'Pages', path: '#' },
    { label: 'Unknown Page', path: '#' }
  ];
};
function Main() {
  const dispatch = useAppDispatch();
  const compactMenu = useAppSelector(selectCompactMenu);
  const setCompactMenu = (val: boolean) => {
    localStorage.setItem("compactMenu", val.toString());
    dispatch(setCompactMenuStore(val));
  };
  const [quickSearch, setQuickSearch] = useState(false);
  const [switchAccount, setSwitchAccount] = useState(false);
  const [notificationsPanel, setNotificationsPanel] = useState(false);
  const [compactMenuOnHover, setCompactMenuOnHover] = useState(false);
  const [activeMobileMenu, setActiveMobileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const [formattedMenu, setFormattedMenu] = useState<
    Array<FormattedMenu | string>
  >([]);
  const sideMenuStore = useAppSelector(selectSideMenu);
  const sideMenu = () => nestedMenu(sideMenuStore, location);
  const scrollableRef = createRef<HTMLDivElement>();
  const breadcrumbItems = getBreadcrumbItems(location.pathname);
    
  // Debug: log breadcrumb items
  useEffect(() => {
    console.log('📍 Current path:', location.pathname);
    console.log('📍 Breadcrumb items:', breadcrumbItems);
  }, [location.pathname, breadcrumbItems]);

  const toggleCompactMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setCompactMenu(!compactMenu);
  };

  const compactLayout = () => {
    if (window.innerWidth <= 1600) {
      setCompactMenu(true);
    }
  };

  const requestFullscreen = () => {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen();
    }
  };

   // Fungsi untuk mengambil jumlah notifikasi belum dibaca
    const loadUnreadCount = async () => {
      try {
        const data = await iotService.getUnreadCount();
        setUnreadCount(data.unreadCount || 0);
      } catch (err) {
        console.error('Failed to load unread count:', err);
      }
    };
  
    // Setup WebSocket untuk real-time notifications
    const setupWebSocketNotifications = () => {
      const cleanup = setupWebSocket((data: any) => {
        console.log('📨 WebSocket data received in Main:', data);
        
        if (data.type === 'notification:new') {
          // Notifikasi baru, increment counter
          setUnreadCount(prev => prev + 1);
        } else if (data.type === 'notification:read') {
          // Satu notifikasi dibaca, decrement counter
          setUnreadCount(prev => Math.max(0, prev - 1));
        } else if (data.type === 'notification:all-read') {
          // Semua notifikasi dibaca, set ke 0
          setUnreadCount(0);
        } else if (data.type === 'unread-count') {
          // Update langsung dari server
          setUnreadCount(data.unreadCount);
        } else if (data.type === 'notification:deleted') {
          // Notifikasi dihapus, perlu reload untuk update count
          loadUnreadCount();
        }
      });
  
      return cleanup;
    };
  
    // Load unread count on mount
    useEffect(() => {
      loadUnreadCount();
      
      // Refresh every 30 seconds
      const interval = setInterval(() => {
        loadUnreadCount();
      }, 30000);
      
      return () => clearInterval(interval);
    }, []);
  
    // Setup WebSocket for real-time updates
    useEffect(() => {
      const cleanup = setupWebSocketNotifications();
      return () => {
        if (cleanup) cleanup();
      };
    }, []);
    //end WebSocket setup

  useEffect(() => {
    if (scrollableRef.current) {
      new SimpleBar(scrollableRef.current);
    }

    setFormattedMenu(sideMenu());
    compactLayout();

    window.onresize = () => {
      compactLayout();
    };
  }, [sideMenuStore, location]);

  return (
    <div
      className={clsx([
        "hook",
        "before:content-[''] before:z-[-1] before:w-screen before:bg-gradient-to-b before:from-theme-1 before:to-theme-2 before:top-0 before:h-screen before:fixed before:bg-fixed",
      ])}
    >
      <div
        className={clsx([
          "xl:ml-0 shadow-xl transition-[margin] duration-300 xl:shadow-none fixed top-0 left-0 z-50 side-menu group",
          "after:content-[''] after:fixed after:inset-0 after:bg-black/80 after:xl:hidden",
          { "side-menu--collapsed": compactMenu },
          { "side-menu--on-hover": compactMenuOnHover },
          { "ml-0 after:block": activeMobileMenu },
          { "-ml-[275px] after:hidden": !activeMobileMenu },
        ])}
      >
        <div
          className={clsx([
            "fixed ml-[275px] w-10 h-10 items-center justify-center xl:hidden z-50",
            { flex: activeMobileMenu },
            { hidden: !activeMobileMenu },
          ])}
        >
          <a
            href=""
            onClick={(event) => {
              event.preventDefault();
              setActiveMobileMenu(false);
            }}
            className="mt-5 ml-5"
          >
            <Lucide icon="X" className="w-8 h-8 text-white" />
          </a>
        </div>
        <div
          className={clsx([
            "z-20 relative w-[275px] border-slate-200/80 duration-300 transition-[width] group-[.side-menu--collapsed]:xl:w-[91px] group-[.side-menu--collapsed.side-menu--on-hover]:xl:shadow-[6px_0_12px_-4px_#0000000f] group-[.side-menu--collapsed.side-menu--on-hover]:xl:w-[275px] h-screen flex flex-col",
            "before:content-[''] before:absolute before:inset-0 before:xl:rounded-[0_0.75rem_0.75rem_0/0_1.1rem_1.1rem_0] before:bg-gradient-to-b before:from-theme-1 before:to-theme-2 before:border-slate-200/80 before:group-[.side-menu--collapsed.side-menu--on-hover]:xl:shadow-[6px_0_12px_-4px_#0000000f]",
            "after:content-[''] after:absolute after:inset-0 after:bg-texture-white after:bg-contain after:bg-fixed after:bg-[center_-20rem] after:bg-no-repeat group-[.side-menu--collapsed.side-menu--on-hover]:xl:after:rounded-[0_0.75rem_0.75rem_0/0_1.1rem_1.1rem_0]",
          ])}
          onMouseOver={(event) => {
            event.preventDefault();
            setCompactMenuOnHover(true);
          }}
          onMouseLeave={(event) => {
            event.preventDefault();
            setCompactMenuOnHover(false);
          }}
        >
          <div className="flex-none hidden xl:flex items-center z-10 px-5 h-[65px] w-[275px] overflow-hidden relative duration-300 group-[.side-menu--collapsed]:xl:w-[91px] group-[.side-menu--collapsed.side-menu--on-hover]:xl:w-[275px]">
            <a
              href=""
              className="flex items-center transition-[margin] duration-300 group-[.side-menu--collapsed]:xl:ml-4 group-[.side-menu--collapsed.side-menu--on-hover]:xl:ml-0"
            >
              <div className="transition-transform ease-in-out group-[.side-menu--collapsed.side-menu--on-hover]:xl:-rotate-180">
                <div className="w-[18px] h-[18px] relative -rotate-45 [&_div]:bg-white">
                  <div className="absolute w-[21%] left-0 inset-y-0 my-auto rounded-full opacity-50 h-[75%]"></div>
                  <div className="absolute w-[21%] inset-0 m-auto h-[120%] rounded-full"></div>
                  <div className="absolute w-[21%] right-0 inset-y-0 my-auto rounded-full opacity-50 h-[75%]"></div>
                </div>
              </div>
              <div className="ml-3.5 group-[.side-menu--collapsed.side-menu--on-hover]:xl:opacity-100 group-[.side-menu--collapsed]:xl:opacity-0 transition-opacity font-medium text-white">
                SIPANGFER
              </div>
            </a>
            <a
              href=""
              onClick={toggleCompactMenu}
              className="group-[.side-menu--collapsed.side-menu--on-hover]:xl:opacity-100 group-[.side-menu--collapsed]:xl:rotate-180 group-[.side-menu--collapsed]:xl:opacity-0 transition-[opacity,transform] hidden 3xl:flex items-center justify-center w-[20px] h-[20px] ml-auto border rounded-full border-white/40 text-white hover:bg-white/5"
            >
              <Lucide icon="ArrowLeft" className="w-3.5 h-3.5 stroke-[1.3]" />
            </a>
          </div>
          <div
            ref={scrollableRef}
            className={clsx([
              "w-full h-full z-20 px-5 overflow-y-auto overflow-x-hidden pb-3 [-webkit-mask-image:-webkit-linear-gradient(top,rgba(0,0,0,0),black_30px)] [&:-webkit-scrollbar]:w-0 [&:-webkit-scrollbar]:bg-transparent",
              "[&_.simplebar-content]:p-0 [&_.simplebar-track.simplebar-vertical]:w-[10px] [&_.simplebar-track.simplebar-vertical]:mr-0.5 [&_.simplebar-track.simplebar-vertical_.simplebar-scrollbar]:before:bg-slate-400/30",
            ])}
          >
            <ul className="scrollable">
              {/* BEGIN: First Child */}
              {formattedMenu.map((menu, menuKey) =>
                typeof menu == "string" ? (
                  <li className="side-menu__divider" key={menuKey}>
                    {menu}
                  </li>
                ) : (
                  <li key={menuKey}>
                    <a
                      href=""
                      className={clsx([
                        "side-menu__link",
                        { "side-menu__link--active": menu.active },
                        {
                          "side-menu__link--active-dropdown":
                            menu.activeDropdown,
                        },
                      ])}
                      onClick={(event: React.MouseEvent) => {
                        event.preventDefault();
                        linkTo(menu, navigate);
                        setFormattedMenu([...formattedMenu]);
                      }}
                    >
                      <Lucide
                        icon={menu.icon}
                        className="side-menu__link__icon"
                      />
                      <div className="side-menu__link__title">{menu.title}</div>
                      {menu.badge && (
                        <div className="side-menu__link__badge">
                          {menu.badge}
                        </div>
                      )}
                      {menu.subMenu && (
                        <Lucide
                          icon="ChevronDown"
                          className="side-menu__link__chevron"
                        />
                      )}
                    </a>
                    {/* BEGIN: Second Child */}
                    {menu.subMenu && (
                      <Transition
                        in={menu.activeDropdown}
                        onEnter={enter}
                        onExit={leave}
                        timeout={300}
                      >
                        <ul
                          className={clsx([
                            "",
                            { block: menu.activeDropdown },
                            { hidden: !menu.activeDropdown },
                          ])}
                        >
                          {menu.subMenu.map((subMenu, subMenuKey) => (
                            <li key={subMenuKey}>
                              <a
                                href=""
                                className={clsx([
                                  "side-menu__link",
                                  { "side-menu__link--active": subMenu.active },
                                  {
                                    "side-menu__link--active-dropdown":
                                      subMenu.activeDropdown,
                                  },
                                ])}
                                onClick={(event: React.MouseEvent) => {
                                  event.preventDefault();
                                  linkTo(subMenu, navigate);
                                  setFormattedMenu([...formattedMenu]);
                                }}
                              >
                                <Lucide
                                  icon={subMenu.icon}
                                  className="side-menu__link__icon"
                                />
                                <div className="side-menu__link__title">
                                  {subMenu.title}
                                </div>
                                {subMenu.badge && (
                                  <div className="side-menu__link__badge">
                                    {subMenu.badge}
                                  </div>
                                )}
                                {subMenu.subMenu && (
                                  <Lucide
                                    icon="ChevronDown"
                                    className="side-menu__link__chevron"
                                  />
                                )}
                              </a>
                              {/* BEGIN: Third Child */}
                              {subMenu.subMenu && (
                                <Transition
                                  in={subMenu.activeDropdown}
                                  onEnter={enter}
                                  onExit={leave}
                                  timeout={300}
                                >
                                  <ul
                                    className={clsx([
                                      "",
                                      {
                                        block: subMenu.activeDropdown,
                                      },
                                      { hidden: !subMenu.activeDropdown },
                                    ])}
                                  >
                                    {subMenu.subMenu.map(
                                      (lastSubMenu, lastSubMenuKey) => (
                                        <li key={lastSubMenuKey}>
                                          <a
                                            href=""
                                            className={clsx([
                                              "side-menu__link",
                                              {
                                                "side-menu__link--active":
                                                  lastSubMenu.active,
                                              },
                                              {
                                                "side-menu__link--active-dropdown":
                                                  lastSubMenu.activeDropdown,
                                              },
                                            ])}
                                            onClick={(
                                              event: React.MouseEvent
                                            ) => {
                                              event.preventDefault();
                                              linkTo(lastSubMenu, navigate);
                                              setFormattedMenu([
                                                ...formattedMenu,
                                              ]);
                                            }}
                                          >
                                            <Lucide
                                              icon={lastSubMenu.icon}
                                              className="side-menu__link__icon"
                                            />
                                            <div className="side-menu__link__title">
                                              {lastSubMenu.title}
                                            </div>
                                            {lastSubMenu.badge && (
                                              <div className="side-menu__link__badge">
                                                {lastSubMenu.badge}
                                              </div>
                                            )}
                                          </a>
                                        </li>
                                      )
                                    )}
                                  </ul>
                                </Transition>
                              )}
                              {/* END: Third Child */}
                            </li>
                          ))}
                        </ul>
                      </Transition>
                    )}
                    {/* END: Second Child */}
                  </li>
                )
              )}
              {/* END: First Child */}
            </ul>
          </div>
        </div>
        <div
          className={clsx([
            "fixed h-[65px] transition-[margin] duration-100 xl:ml-[275px] group-[.side-menu--collapsed]:xl:ml-[90px] mt-3.5 inset-x-0 top-0",
            "before:content-[''] before:mx-5 before:absolute before:top-0 before:inset-x-0 before:-mt-[15px] before:h-[20px] before:backdrop-blur",
          ])}
        >
          <div
            className="
              absolute inset-x-0 h-full mx-5 box rounded-xl
              before:content-[''] before:z-[-1] before:inset-x-4 before:shadow-sm before:h-full before:bg-slate-50 before:border before:border-slate-200 before:absolute before:rounded-lg before:mx-auto before:top-0 before:mt-3 before:dark:bg-darkmode-600/70 before:dark:border-darkmode-500/60
            "
          >
            <div className="flex items-center w-full h-full px-5">
              <div className="flex items-center gap-1 xl:hidden">
                <a
                  href=""
                  onClick={(event) => {
                    event.preventDefault();
                    setActiveMobileMenu(true);
                  }}
                  className="p-2 rounded-full hover:bg-slate-100"
                >
                  <Lucide icon="AlignJustify" className="w-[18px] h-[18px]" />
                </a>
                <a
                  href=""
                  className="p-2 rounded-full hover:bg-slate-100"
                  onClick={(e) => {
                    e.preventDefault();
                    setQuickSearch(true);
                  }}
                >
                  <Lucide icon="Search" className="w-[18px] h-[18px]" />
                </a>
              </div>
              {/* BEGIN: Breadcrumb - DINAMIS */}
              <Breadcrumb light className="flex-1 hidden xl:block">
                {breadcrumbItems.map((item: { label: string; path: string }, index: number) => {
                  const isLast = index === breadcrumbItems.length - 1;
                  const isFirst = index === 0;
                  
                  if (isFirst) {
                    return (
                      <Breadcrumb.Link
                        key={index}
                        className="dark:before:bg-chevron-white"
                        to={item.path}
                      >
                        {item.label}
                      </Breadcrumb.Link>
                    );
                  }
                  
                  if (isLast) {
                    return (
                      <Breadcrumb.Link
                        key={index}
                        className="dark:before:bg-chevron-white"
                        to={item.path}
                        active={true}
                      >
                        {item.label}
                      </Breadcrumb.Link>
                    );
                  }
                  
                  return (
                    <Breadcrumb.Link
                      key={index}
                      className="dark:before:bg-chevron-white"
                      to={item.path}
                    >
                      {item.label}
                    </Breadcrumb.Link>
                  );
                })}
              </Breadcrumb>
              {/* END: Breadcrumb */}
              {/* BEGIN: Notification & User Menu */}
              <div className="flex items-center flex-1">
                <div className="flex items-center gap-1 ml-auto">
                  <a
                    href=""
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-darkmode-400"
                    onClick={(e) => {
                      e.preventDefault();
                      requestFullscreen();
                    }}
                  >
                    <Lucide icon="Expand" className="w-[18px] h-[18px]" />
                  </a>
                  <a
                    href=""
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-darkmode-400/5 relative block"
                    onClick={(e) => {
                      e.preventDefault();
                      setNotificationsPanel(true);
                    }}
                  >
                    <Lucide 
                      icon="Bell" 
                      className="w-[18px] h-[18px] text-slate-600 dark:text-white" 
                    />
                    
                    {/* Badge untuk jumlah notifikasi */}
                    {unreadCount > 0 && (
                      <span 
                        className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center shadow-lg ring-2 ring-white dark:ring-darkmode-800"
                        style={{ lineHeight: 'normal' }}
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </a>
                </div>
              </div>
              <NotificationsPanel
                notificationsPanel={notificationsPanel}
                setNotificationsPanel={setNotificationsPanel}
              />
              <SwitchAccount
                switchAccount={switchAccount}
                setSwitchAccount={setSwitchAccount}
              />
              {/* END: Notification*/}
            </div>
          </div>
        </div>
      </div>
      <div
        className={clsx([
          "relative transition-[margin,width] duration-100 px-5 pt-[66px] pb-16",
          "before:content-[''] before:bg-texture-white before:bg-contain before:bg-fixed before:bg-[center_-20rem] before:bg-no-repeat before:h-screen before:w-full before:fixed before:top-0 before:-ml-5",
          "after:content-[''] after:bg-gradient-to-b after:from-slate-100 after:to-slate-50 after:h-screen after:w-full after:fixed after:top-0 after:-ml-5 after:xl:rounded-[1.2rem/1.7rem] dark:after:from-darkmode-800 dark:after:to-darkmode-700",
          { "xl:ml-[275px]": !compactMenu },
          { "xl:ml-[91px]": compactMenu },
        ])}
      >
        <div className="container mt-[55px] z-10 relative">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default Main;
