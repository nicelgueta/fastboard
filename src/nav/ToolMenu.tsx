import React from 'react';
import {
  Box,
  Input,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Button,
  Text,
  VStack,
  HStack,
} from '@chakra-ui/react';
import useAppColors from '../hooks/useAppColors';
import { componentType } from '../interfaces';
import { useKey } from '../hooks/useKey';

export interface ToolMenuItem {
  value: string;
  label: string;
  description?: string;
  group?: string;      // optional section header
  disabled?: boolean;
}

export interface ToolMenuProps {
  label: string;                 // button text, e.g. "Add tool"
  items: ToolMenuItem[];
  onSelect: (value: string) => void;
  icon?: React.ReactElement;
  typ?: componentType;           // color token family
  emptyText?: string;
  hotkey?: string;               // e.g. "Digit1"
}

/**
 * A searchable dropdown that opens to the full list of items and filters as
 * you type. Replaces TextSearch, which only showed a popover once you typed
 * and required a separate ADD/LOAD button. Selecting an item here fires
 * onSelect immediately and closes the menu.
 *
 * Focus handling: Chakra's <Menu> manages focus and its <MenuItem>s steal
 * arrow keys from any <Input> rendered inside <MenuList>. To work around
 * this: autoSelect is off on the <Menu>, the search <Input> lives in a plain
 * <Box> (not a MenuItem) so Chakra never tries to focus-manage it, and its
 * onKeyDown stops propagation for everything except Escape/Enter/Arrow keys
 * so Chakra's menu-level handlers do not intercept normal typing (e.g. space
 * would otherwise trigger menu item selection). Highlighted index is tracked
 * in local state and driven entirely by our own key handling.
 */
const ToolMenu: React.FC<ToolMenuProps> = ({
  label,
  items,
  onSelect,
  icon,
  typ,
  emptyText,
  hotkey,
}) => {
  const [colors] = useAppColors();
  const menuTyp: componentType = typ || 'info';
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [highlighted, setHighlighted] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const sortedItems = React.useMemo(
    () => [...items].sort((a, b) => a.label.localeCompare(b.label)),
    [items]
  );

  const filteredItems = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedItems;
    return sortedItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) || item.value.toLowerCase().includes(q)
    );
  }, [sortedItems, query]);

  const open = React.useCallback(() => {
    setQuery('');
    setHighlighted(0);
    setIsOpen(true);
  }, []);

  const close = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      // focus the search input once the menu list has rendered
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  React.useEffect(() => {
    // keep highlighted index in range whenever the filtered list changes
    setHighlighted((h) => {
      if (filteredItems.length === 0) return 0;
      return Math.min(h, filteredItems.length - 1);
    });
  }, [filteredItems]);

  useKey(hotkey || '__tool-menu-no-hotkey__', () => {
    if (hotkey) {
      open();
    }
  });

  const selectItem = (item: ToolMenuItem) => {
    if (item.disabled) return;
    onSelect(item.value);
    close();
  };

  const moveHighlight = (delta: number) => {
    setHighlighted((h) => {
      if (filteredItems.length === 0) return 0;
      let next = h + delta;
      // skip disabled items
      for (let i = 0; i < filteredItems.length; i++) {
        if (next < 0) next = filteredItems.length - 1;
        if (next >= filteredItems.length) next = 0;
        if (!filteredItems[next].disabled) return next;
        next += delta;
      }
      return h;
    });
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Always stop propagation so Chakra's Menu/MenuList keydown handling
    // (typeahead, arrow-key focus management onto MenuItem refs, etc.)
    // never sees these events - focus must stay on this Input the entire
    // time the menu is open, or the DOM focus would jump to a MenuItem and
    // typing would stop working. Escape/Enter/Arrow are handled explicitly
    // below ourselves instead of letting Chakra react to them.
    e.stopPropagation();
    switch (e.key) {
      case 'Escape':
        close();
        break;
      case 'Enter': {
        const item = filteredItems[highlighted];
        if (item) selectItem(item);
        break;
      }
      case 'ArrowDown':
        e.preventDefault();
        moveHighlight(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveHighlight(-1);
        break;
      default:
        // normal typing (letters, backspace, space, etc.) reaches the
        // Input's own onChange as usual.
        break;
    }
  };

  return (
    <Menu
      isOpen={isOpen}
      onOpen={open}
      onClose={close}
      autoSelect={false}
      closeOnSelect={false}
    >
      <MenuButton
        as={Button}
        size="sm"
        // Deliberately NOT w/h="100%": this used to live in a fixed-size grid
        // cell, but the header is a flex row now - a 100% width makes every
        // menu claim the whole row and forces the header to wrap onto three
        // lines. Size to content instead, with a floor so the labels line up.
        minW="120px"
        flexShrink={0}
        whiteSpace="nowrap"
        rightIcon={icon}
        bg={colors[`${menuTyp}Half`]}
        textColor={colors.fore}
        borderColor={colors[`${menuTyp}Half`]}
        borderRadius={0}
        borderWidth={1}
        _hover={{ bg: colors[`${menuTyp}3Quarter`] }}
        _active={{ bg: colors[`${menuTyp}3Quarter`] }}
      >
        {label}
      </MenuButton>
      <MenuList
        bg={colors.bg}
        borderColor={colors[`${menuTyp}Half`]}
        borderRadius={0}
        maxH="60vh"
        overflowY="auto"
        zIndex={20}
        minW="300px"
      >
        <Box px={2} pb={1} pt={0}>
          <Input
            ref={inputRef}
            autoComplete="off"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            borderRadius={0}
            borderColor={colors[`${menuTyp}Half`]}
            textColor={colors.fore}
            bg={colors.bgHalf}
            _hover={{ borderColor: colors[menuTyp] }}
            _focusVisible={{ borderColor: colors[menuTyp] }}
          />
        </Box>
        {filteredItems.length === 0 ? (
          <Box px={3} py={2}>
            <Text color={colors.foreHalf} fontSize="sm">
              {emptyText || 'No items found'}
            </Text>
          </Box>
        ) : (
          filteredItems.map((item, i) => (
            <MenuItem
              key={item.value}
              isDisabled={item.disabled}
              onClick={() => selectItem(item)}
              onMouseEnter={() => setHighlighted(i)}
              bg={i === highlighted ? colors[`${menuTyp}Quarter`] : colors.bg}
              _hover={{
                bg: item.disabled ? colors.bg : colors[`${menuTyp}Quarter`],
              }}
              opacity={item.disabled ? 0.4 : 1}
            >
              <VStack align="flex-start" spacing={0} w="100%">
                <HStack justify="space-between" w="100%">
                  <Text color={colors.fore} fontSize="sm">
                    {item.label}
                  </Text>
                  {item.disabled && (
                    <Text color={colors.foreHalf} fontSize="xs">
                      max reached
                    </Text>
                  )}
                </HStack>
                {item.description && (
                  <Text color={colors.foreHalf} fontSize="xs" noOfLines={2}>
                    {item.description}
                  </Text>
                )}
              </VStack>
            </MenuItem>
          ))
        )}
      </MenuList>
    </Menu>
  );
};

export default ToolMenu;
