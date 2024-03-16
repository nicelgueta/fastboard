import React, { forwardRef, useEffect, useRef, useState } from "react";
import _ from "lodash";
import {
  Input,
  Box,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Text,
  HStack,
  PopoverProps,
} from "@chakra-ui/react";
import useAppColors from "../hooks/colors";
import useCustomToast from "../hooks/useCustomToast";
import Bu, { bType } from "./Button";

export interface OptionItem {
  label: string;
  value: string;
}

interface DropdownProps extends PopoverProps {
  name?: string;
  options: OptionItem[];
  value: string;
  onChange: (value: string) => void;
  onTextChange: (text: string) => void;
  onSelect: (value: string) => void;
  h?: string;
  w?: string;
  borderColor?: string;
  borderRadius?: number;
  bg?: string;
  textColor?: string;
  placeholder?: string;
}

const Dropdown = forwardRef<HTMLInputElement, DropdownProps>(
  (
    {
      name,
      options,
      value,
      onChange,
      onTextChange,
      onSelect,
      h,
      w,
      borderColor,
      borderRadius,
      bg,
      textColor,
      placeholder,
    },
    ref
  ) => {
    const isSearchActive = useRef(false);
    const [active, setActive] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
      function fetchValues() {
        if (value) {
          onChange(value);
        }
      }
      fetchValues();
    }, [options, value, onChange]);

    const handleTextChange = (text: string) => {
      onChange(text);
      setActive(0);
      onTextChange(text);
      isSearchActive.current = true;
      setIsOpen(options.length > 0 && isSearchActive.current);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      const isUpKeyCode = event.keyCode === 38;
      const isDownKeyCode = event.keyCode === 40;
      const isEnterKeyCode = event.keyCode === 13;
      const isExitKeyCode = event.keyCode === 27;
      if (isUpKeyCode && active > 0) {
        setActive(active - 1);
      }
      if (isDownKeyCode && active < options.length - 1) {
        setActive(active + 1);
      }
      if (isEnterKeyCode) {
        onChange(options[active].label);
        setIsOpen(false);
      }
      if (isExitKeyCode) {
        setIsOpen(false);
      }
    };

    return (
      <Popover isOpen={isOpen} autoFocus={false} matchWidth>
        <PopoverTrigger>
          <Input
            ref={ref}
            name={name}
            type="text"
            value={value}
            autoComplete="off"
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            isRequired
            h={h}
            w={w}
            borderColor={borderColor}
            borderRadius={borderRadius}
            bg={bg}
            textColor={textColor}
            placeholder={placeholder}
          />
        </PopoverTrigger>
        <PopoverContent w="500px" zIndex={4}>
          {options?.map((option, i) => (
            <Option
              key={option.value}
              label={option.label}
              value={option.value}
              onChange={onChange}
              onSelect={onSelect}
              setIsOpen={setIsOpen}
              index={i}
              active={active}
            />
          ))}
        </PopoverContent>
      </Popover>
    );
  }
);

interface OptionProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  index: number;
  active: number;
}

const Option: React.FC<OptionProps> = ({
  label,
  value,
  onChange,
  onSelect,
  setIsOpen,
  index,
  active,
}) => {
  const colors = useAppColors();

  const updateText = () => {
    onChange(value);
    onSelect(value);
    setIsOpen(false);
  };

  const getColors = () => {
    if (active === index) {
      return {
        bg: colors.bg,
        textColor: colors.foreActiveLight,
        _hover: {
          bg: colors.foreActiveLight,
          textColor: colors.bg,
        },
      };
    } else {
      return {
        bg: colors.bg,
        textColor: colors.fore,
        _hover: {
          bg: colors.foreActiveLight,
          textColor: colors.bg,
        },
      };
    }
  };

  return (
    <Box onClick={updateText} p={1} {...getColors()}>
      <Text cursor="pointer">{label}</Text>
    </Box>
  );
};

Dropdown.displayName = "Dropdown";

interface TextSearchProps {
  placeholder: string;
  items: OptionItem[];
  callback: (selectedItem: string | null) => void;
  buttonText: string;
  buttonType: bType;
  w?: string;
  h?: string;
}

const TextSearch: React.FC<TextSearchProps> = ({
  placeholder,
  items,
  callback,
  buttonText,
  buttonType,
  w,
  h,
}) => {
  const [options, setOptions] = useState(items.sort(
    (a, b) => a.label.localeCompare(b.label) 
  ) || []);
  const [textValue, setTextValue] = useState("");
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const toast = useCustomToast();

  const colors = useAppColors();

  const onTextChange = (text: string) => {
    const newOptions = _.filter(
      items,
      (item) => item.label.toLowerCase().includes(text.toLowerCase()) || item.value.toLowerCase().includes(text.toLowerCase())
    );
    setOptions(newOptions);
  };

  const search = () => {
    if (!selectedItem) {
      toast(
          "No item selected",
          "fail",
      );
      return;
    }
    callback(selectedItem);
    setTextValue("");
    setSelectedItem(null);
  };
  return (
    <HStack w={w} h={h}>
      <Dropdown
        options={options}
        value={textValue}
        onChange={setTextValue}
        onSelect={setSelectedItem}
        onTextChange={onTextChange}
        borderColor={colors.foreQuarter}
        borderRadius={0}
        bg={colors.bg3Quarter}
        textColor={colors.foreActiveLight}
        placeholder={placeholder}
        h="100%"
        w="100%"
      />
      <Bu bType={buttonType} h="95%" onClick={search}>
        {buttonText}
      </Bu>
    </HStack>
  );
};

export default TextSearch;
