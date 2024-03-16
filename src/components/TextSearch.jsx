import React from "react";
import { forwardRef, useState, useRef, useEffect } from "react";
import _ from "lodash";
import {
    Input,
    Box,
    Popover,
    PopoverTrigger,
    PopoverContent,
    Text,
    useColorMode,
    HStack,
} from "@chakra-ui/react";
import useAppColors from "../hooks/colors";

import Bu from "../components/Button";

const Dropdown = forwardRef(
  ({ 
    name, options, value, onChange, onTextChange, onSelect, ...props 
}, ref) => {
    const isSearchActive = useRef(false);
    const [active, setActive] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const { colorMode } = useColorMode();

    useEffect((value) => {
      function fetchValues() {
        if (value) {
          onChange(_.find(options, { value }).label);
        }
      }
      fetchValues();
    });

    const handleTextChange = (text) => {
      onChange(text);
      setActive(0);
      onTextChange(text);
      isSearchActive.current = true;
      setIsOpen(options.length > 0 && isSearchActive.current);
    };

    const handleKeyDown = (event) => {
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
        <Popover 
            {...props} 
            isOpen={isOpen} 
            autoFocus={false} 
            matchWidth
        >
        <PopoverTrigger>
          <Input
            ref={ref}
            name={name}
            type={"text"}
            value={value}
            autoComplete="off"
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            isRequired={true}
            {...props}
            />
        </PopoverTrigger>
        <PopoverContent 
            w="500px"
            zIndex={4}
        >
          {options?.map((option, value) => (
              <Option
              key={option.value}
              i={value}
              {...option}
              onChange={onChange}
              />
              ))}
        </PopoverContent>
      </Popover>
    );
    
    function Option({ label, i, onChange }) {
        const colors = useAppColors();
        function updateText() {
            onChange(options[i].value);
            onSelect(options[i].value);
            setIsOpen(false);
        }

        const getColors = (active, i) => {
            if (active === i) {
                return {
                    bg: colors.bg,
                    textColor: colors.foreActiveLight,
                    _hover: {
                        bg: colors.foreActiveLight,
                        textColor: colors.bg,
                    }
                }
            } else {
                return {
                    bg: colors.bg,
                    textColor: colors.fore,
                    _hover: {
                        bg: colors.foreActiveLight,
                        textColor: colors.bg,
                    }
                }
            };
        }

        return (
            <Box
                onClick={() => updateText()}
                p={1}
                {...getColors()}
            >
                <Text cursor={"pointer"}>{label}</Text>
            </Box>
        );
    }
  }
);

Dropdown.displayName = "Dropdown";

export default ({
    placeholder,
    items,
    callback,
    buttonText,
    buttonType,
    ...props
}) => {
    const [options, setOptions] = useState(items || []);
    const [textValue, setTextValue] = useState("");
    const [selectedItem, setSelectedItem] = useState(null);

    const colors = useAppColors();

    const onTextChange = (text) => {
        const newOptions = _.filter(items, (item) => item.label.toLowerCase().includes(text.toLowerCase()));
        setOptions(newOptions);
    }

    const search = () => {
        if (!selectedItem) {
            alert("No item selected")
            return
        }
        callback(selectedItem);
        setTextValue("");
        setSelectedItem(null);
    }
    return (
        <HStack
            w={props.w}
            h={props.h}
        >
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
                {...props}
                h="100%"
                w="100%"
            />
            <Bu
                type={buttonType}
                h="100%"
                onClick={search}
            >
                {buttonText}
            </Bu>
        </HStack>
    );
}