import { Link, useLocation } from 'react-router-dom';
import { Wrench, ClipboardCheck, CircleDot, Camera } from 'lucide-react';

export default function BottomNavbar() {
  const location = useLocation();

  const navItems = [
    { path: '/repair', icon: Wrench, label: 'ซ่อม' },
    { path: '/inspection', icon: ClipboardCheck, label: 'ตรวจรถ' },
    { path: '/tire', icon: CircleDot, label: 'ยาง' },
    { path: '/photo', icon: Camera, label: 'รูปถ่าย' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  isActive
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                <Icon className={`w-6 h-6 ${isActive ? 'scale-110' : ''} transition-transform`} />
                <span className={`text-xs mt-1 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-600 dark:bg-green-400 rounded-t-full" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

