'use client';

import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';

interface ColorPickerProps {
  onColorSelect: (color: 'red' | 'yellow' | 'blue' | 'green') => void;
  isOpen: boolean;
}

const ColorPicker = ({ onColorSelect, isOpen }: ColorPickerProps) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  // FIXED: guard against double-tap firing onColorSelect twice for the same
  // wild card while the fade-out animation is still in flight. Without this,
  // a second tap during the 0.2s gsap.to window queues a second onComplete,
  // which calls handleColorSelect again in the parent and can double-write
  // updateGameResult for every player in the room.
  const [hasSelected, setHasSelected] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset the guard whenever a fresh wild card triggers the picker.
      setHasSelected(false);
    }
    if (isOpen && pickerRef.current) {
      gsap.fromTo(
        pickerRef.current,
        { scale: 0, opacity: 0, rotateZ: -20 },
        { scale: 1, opacity: 1, rotateZ: 0, duration: 0.4, ease: 'back.out(2)' }
      );
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const colors: { name: 'red' | 'yellow' | 'blue' | 'green'; bg: string; label: string }[] = [
    { name: 'red', bg: '#EF4444', label: 'Red' },
    { name: 'yellow', bg: '#EAB308', label: 'Yellow' },
    { name: 'blue', bg: '#3B82F6', label: 'Blue' },
    { name: 'green', bg: '#22C55E', label: 'Green' },
  ];

  const handleSelect = (color: 'red' | 'yellow' | 'blue' | 'green') => {
    // FIXED: bail out immediately if a selection was already made — this is
    // the actual guard. The ref-based animation kill below closes the gap
    // for any tween still in flight on a rapid second tap.
    if (hasSelected) return;
    setHasSelected(true);

    if (pickerRef.current) {
      gsap.killTweensOf(pickerRef.current);
      gsap.to(pickerRef.current, {
        scale: 0.8,
        opacity: 0,
        duration: 0.2,
        onComplete: () => onColorSelect(color),
      });
    } else {
      onColorSelect(color);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div ref={pickerRef} className="bg-gray-900/95 rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl max-w-xs w-full">
        <h3 className="text-white text-lg sm:text-xl font-bold text-center mb-2">
          Choose a Color
        </h3>
        <p className="text-white/50 text-xs sm:text-sm text-center mb-6">
          Select the color for your wild card
        </p>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {colors.map(({ name, bg, label }) => (
            <button
              key={name}
              onClick={() => handleSelect(name)}
              disabled={hasSelected}
              className="
                aspect-square rounded-2xl flex flex-col items-center justify-center gap-2
                transition-transform duration-200 active:scale-90
                hover:scale-105 border-2 border-white/20 hover:border-white/50
                min-h-[80px] sm:min-h-[100px]
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
              "
              style={{
                backgroundColor: bg,
                boxShadow: `0 4px 20px ${bg}66`,
              }}
            >
              <span className="text-3xl sm:text-4xl">
                {name === 'red' ? '♦' : name === 'yellow' ? '★' : name === 'blue' ? '♠' : '♣'}
              </span>
              <span className="text-white font-bold text-xs sm:text-sm">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ColorPicker;