"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Coffee, Home, MapPin, Bean, User, Camera, PenLine, Plus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { path: "/", label: "홈", icon: Home },
  { path: "/cafes", label: "카페찾기", icon: MapPin },
];

const navItemsRight = [
  { path: "/beans", label: "원두찾기", icon: Bean },
  { path: "/history", label: "내기록", icon: User },
];

export default function BottomNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const actionItems = [
    {
      icon: <Camera className="w-6 h-6" />,
      title: "사진으로 기록",
      subtitle: "사진과 함께 상태 기록",
      action: () => {
        router.push("/record/photo");
        setIsExpanded(false);
      }
    },
    {
      icon: <PenLine className="w-6 h-6" />,
      title: "직접 입력",
      subtitle: "수동으로 입력",
      action: () => {
        router.push("/record/manual");
        setIsExpanded(false);
      }
    }
  ];

  return (
    <>
      {/* Expanded Action Items */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fab-actions-integrated"
          >
            {actionItems.map((item, index) => (
              <motion.button
                key={item.title}
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: { delay: index * 0.1 }
                }}
                exit={{
                  opacity: 0,
                  y: 20,
                  scale: 0.8,
                  transition: { delay: (actionItems.length - 1 - index) * 0.1 }
                }}
                onClick={item.action}
                className="fab-action-item"
              >
                <div className="fab-action-icon text-coffee-100">
                  {item.icon}
                </div>
                <div className="fab-action-content">
                  <div className="fab-action-title">{item.title}</div>
                  <div className="fab-action-subtitle">{item.subtitle}</div>
                </div>
                <div className="fab-action-plus">
                  <span>+</span>
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="bottom-nav-integrated">
        <div className="flex items-center justify-center">
          {/* Left Navigation Items */}
          <div className="flex flex-1 justify-center">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`nav-item ${pathname === item.path ? "active" : ""}`}
              >
                <span className="nav-icon"><item.icon className="w-5 h-5" /></span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          {/* Center FAB */}
          <motion.button
            onClick={handleToggle}
            className="fab-integrated"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label={isExpanded ? "메뉴 닫기" : "메뉴 열기"}
          >
            <div className="flex items-center justify-center" suppressHydrationWarning>
              <AnimatePresence mode="wait">
                {isExpanded ? (
                  <motion.div
                    key="close"
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 90 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X className="w-6 h-6" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="plus"
                    initial={{ scale: 0, rotate: 90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: -90 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Plus className="w-7 h-7" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.button>

          {/* Right Navigation Items */}
          <div className="flex flex-1 justify-center">
            {navItemsRight.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`nav-item ${pathname === item.path ? "active" : ""}`}
              >
                <span className="nav-icon"><item.icon className="w-5 h-5" /></span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </>
  );
} 