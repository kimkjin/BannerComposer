import React, { useState, useEffect, useRef } from 'react';
import './SearchableDropdown.css';

function SearchableDropdown({ onSearch, onSelect, placeholder }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (query.trim() === '') {
        setResults([]);
        return;
    }

    const delayDebounceFn = setTimeout(async () => {
      const searchResults = await onSearch(query);
      setResults(searchResults);
      setIsOpen(true);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query, onSearch]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);
  
  const handleSelect = (item) => {
    setQuery(item);
    onSelect(item);
    setIsOpen(false);
  };

  const handleFocus = async () => {
    if (results.length > 0) {
        setIsOpen(true);
        return;
    }
    if (query.trim() === '') {
        const initialResults = await onSearch('');
        setResults(initialResults);
        setIsOpen(true);
    }
  };

  return (
    <div className="searchable-dropdown" ref={wrapperRef}>
      <input
        type="text"
        className="search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={handleFocus} // <-- Adicionado o evento onFocus
        placeholder={placeholder}
        autoComplete="off" // Previne o autocompletar do navegador
      />
      {isOpen && results.length > 0 && (
        <ul className="results-list">
          {results.map((item) => (
            <li key={item} onMouseDown={() => handleSelect(item)}>
              {/* Usar onMouseDown em vez de onClick para disparar antes do evento onBlur do input */}
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SearchableDropdown;