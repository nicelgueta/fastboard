import React, { forwardRef, useEffect, useRef, useState, useCallback } from "react";
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
import useAppColors from "../hooks/useAppColors";
import useUserAlert from "../hooks/useUserAlert";
import FBButton from "./primitive/Button";
import { componentType } from "../interfaces";
import { MdAirlineSeatIndividualSuite } from "react-icons/md";

interface TextSearchProps {
  placeholder: string;
  items: OptionItem[];
  callback: (selectedItem: string | null) => void;
  buttonText: string;
  buttonType: componentType;
  w?: string;
  h?: string;
  clearOnSelect?: boolean;
  showlabel?: boolean;
  openHotkey?: string;
}


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
  placeholder?: string;
  typ: componentType;
  openHotkey?: string;
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
      borderRadius,
      bg,
      placeholder,
      typ,
      openHotkey
    },
    ref
  ) => {
    name = name || `textSearch-${openHotkey||""}`;
    const isSearchActive = useRef(false);
    const [active, setActive] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [colors] = useAppColors();
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

    // Set some global event listeners
    const keyEventFunction = useCallback((event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      } 
      // else if (event.code === openHotkey && event.shiftKey) {
        
      // }
    }, []);

    useEffect(() => {
      document.addEventListener("keydown", keyEventFunction, false);

      return () => {
        document.removeEventListener("keydown", keyEventFunction, false);
      };
    }, [keyEventFunction]);

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
            isRequired
            h={h}
            w={w}
            borderColor={colors[typ+"Half"]}
            borderRadius={borderRadius}
            bg={bg}
            textColor={colors[typ]}
            placeholder={placeholder}
            _hover={{
              borderColor: colors[typ]
            }}
            _focusVisible={{
                borderColor: colors[typ],
                bg: colors[typ+"Dark"]
            }}
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
              typ={typ}
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
  typ: componentType;
}

const Option: React.FC<OptionProps> = ({
  label,
  value,
  onChange,
  onSelect,
  setIsOpen,
  index,
  active,
  typ
}) => {
  const [colors] = useAppColors();

  const updateText = () => {
    onChange(value);
    onSelect(value);
    setIsOpen(false);
  };

  const getColors = () => {
    if (active === index) {
      return {
        bg: colors.bg,
        textColor: colors[typ],
        _hover: {
          bg: colors[typ+"Light"],
          textColor: colors.bg,
        },
      };
    } else {
      return {
        bg: colors.bg,
        textColor: colors[typ],
        _hover: {
          bg: colors[typ+"Light"],
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


const TextSearch: React.FC<TextSearchProps> = ({
  placeholder,
  items,
  callback,
  buttonText,
  buttonType,
  w,
  h,
  clearOnSelect,
  openHotkey
}) => {
  const [options, setOptions] = useState(items.sort(
    (a, b) => a.label.localeCompare(b.label) 
  ) || []);
  const [textValue, setTextValue] = useState("");
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const userAlert = useUserAlert();

  const [colors] = useAppColors();

  const onTextChange = (text: string) => {
    const newOptions = _.filter(
      items,
      (item) => item.label.toLowerCase().includes(text.toLowerCase()) || item.value.toLowerCase().includes(text.toLowerCase())
    );
    setOptions(newOptions);
  };

  const search = () => {
    if (!selectedItem) {
      userAlert(
          "No item selected",
          "fail",
      );
      return;
    }
    callback(selectedItem);
    if (clearOnSelect) {
      setTextValue("");
      setSelectedItem(null);
    }
  };
  return (
    <HStack w={w} h={h}>
      <Dropdown
        options={options}
        value={textValue}
        onChange={setTextValue}
        onSelect={setSelectedItem}
        onTextChange={onTextChange}
        borderRadius={0}
        placeholder={placeholder}
        h="100%"
        w="100%"
        typ={buttonType}
        openHotkey={openHotkey}
      />
      <FBButton typ={buttonType} h="100%" onClick={search}>
        {buttonText}
      </FBButton>
    </HStack>
  );
};

export default TextSearch;
