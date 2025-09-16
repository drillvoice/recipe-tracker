import React, { useState } from 'react';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
}

const PRESET_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Light Yellow
  '#BB8FCE', // Light Purple
  '#85C1E9', // Light Blue
  '#F8C471', // Orange
  '#82E0AA', // Light Green
  '#F1948A', // Light Red
  '#D5DBDB', // Light Gray
  '#AED6F1', // Pale Blue
  '#A9DFBF'  // Pale Green
];

export function ColorPicker({ value, onChange, className = '' }: ColorPickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customColor, setCustomColor] = useState(value);

  const handlePresetClick = (color: string) => {
    onChange(color);
    setShowCustom(false);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setCustomColor(newColor);
    onChange(newColor);
  };

  const toggleCustom = () => {
    setShowCustom(!showCustom);
    if (!showCustom) {
      setCustomColor(value);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="grid grid-cols-8 gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`
              w-8 h-8 rounded-full border-2 transition-all duration-200
              hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
              ${value === color
                ? 'border-gray-800 shadow-md scale-110'
                : 'border-gray-300 hover:border-gray-400'
              }
            `}
            style={{ backgroundColor: color }}
            onClick={() => handlePresetClick(color)}
            aria-label={`Select color ${color}`}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleCustom}
          className="text-sm text-blue-600 hover:text-blue-800 underline focus:outline-none"
        >
          {showCustom ? 'Hide custom' : 'Custom color'}
        </button>

        {showCustom && (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={customColor}
              onChange={handleCustomChange}
              className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
              aria-label="Custom color picker"
            />
            <input
              type="text"
              value={customColor}
              onChange={handleCustomChange}
              placeholder="#000000"
              className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              pattern="^#[0-9A-Fa-f]{6}$"
            />
          </div>
        )}
      </div>
    </div>
  );
}