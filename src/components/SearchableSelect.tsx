import React, { useState, useEffect, useRef } from "react";
import { LookupItem } from "../types";
import { ChevronDown, Check, X } from "lucide-react";

interface SearchableSelectProps {
  id: string;
  options: LookupItem[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  required?: boolean;
}

export default function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder,
  required = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Get current active displayed label matching selection value
  const getSelectedLabel = () => {
    const found = options.find((opt) => opt.id === value);
    if (!found) return "";
    return found.apellido ? `${found.nombre} ${found.apellido}` : found.nombre;
  };

  // Keep search term in sync with selected value when dropdown is closed
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm(getSelectedLabel());
    }
  }, [value, isOpen, options]);

  // Click outside to close standard dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter options based on search text
  const filteredOptions = options.filter((opt) => {
    const fullName = opt.apellido ? `${opt.nombre} ${opt.apellido}` : opt.nombre;
    const match = fullName.toLowerCase().includes(searchTerm.toLowerCase());
    return match;
  });

  const handleSelect = (optId: string) => {
    onChange(optId);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearchTerm("");
    setIsOpen(true);
  };

  return (
    <div className="relative w-full" ref={containerRef} id={`searchable-${id}`}>
      <div className="relative">
        <input
          type="text"
          id={id}
          required={required && !value}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full text-slate-800 bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-10 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all cursor-pointer placeholder-slate-400"
        />
        <div className="absolute right-0 top-0 h-full flex items-center pr-3 gap-1.5">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform cursor-pointer ${isOpen ? "rotate-180" : ""}`}
            onClick={() => setIsOpen(!isOpen)}
          />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto animate-fade-in custom-scrollbar">
          {filteredOptions.length === 0 ? (
            <div className="py-3 px-4 text-xs text-slate-400 text-center">
              No se encontraron resultados
            </div>
          ) : (
            <div className="py-1">
              {filteredOptions.map((opt) => {
                const optLabel = opt.apellido ? `${opt.nombre} ${opt.apellido}` : opt.nombre;
                const isSelected = opt.id === value;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt.id)}
                    className={`w-full text-left px-4 py-2 text-xs flex justify-between items-center transition-colors cursor-pointer ${
                      isSelected 
                        ? "bg-emerald-50/50 text-emerald-800 font-semibold" 
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>{optLabel}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
