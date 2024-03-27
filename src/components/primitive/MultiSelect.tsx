import React, { useState } from 'react';
import { 
    Menu, MenuButton, MenuButtonProps, MenuOptionGroup, MenuItemOption, MenuList, Button
} from '@chakra-ui/react';

import { SelectOption } from '../../interfaces';
import useAppColors from '../../hooks/useAppColors';
import FBButton, { FBButtonProps } from './Button';


interface FBMultiSelectProps extends FBButtonProps {
    setValue?: (value: string[]) => void;
    value?: string[];
    options: SelectOption[];
    boxLabel?: string;
}


const FBMultiSelect: React.FC<FBMultiSelectProps> = ({ 
    typ, value, setValue, options, boxLabel, ...props
}) => {
    const [selected, setSelected] = useState<string[]|string>(value || []);
    React.useEffect(() => {
        if (options.length === 0 ) {
            setSelected([]);
        }
    }, [options]);
    const [colors] = useAppColors();
    typ = typ || "info";
    return (
        <Menu isLazy closeOnSelect={false}>
            <MenuButton 
                as={Button}
                borderRadius={0}
                borderWidth={1}
                textColor={colors.fore}
                borderColor={colors[typ+"Half"]}
                bg={props.variant === "outline" ? colors.bg : colors[typ+"3Quarter"]}
                _hover={{
                    borderColor: colors[typ],
                    bg: colors[typ+"Quarter"]
                }}
                _active={{
                    borderColor: colors[typ],
                    bg: colors[typ+"Quarter"]
                }}
                {...props}
            >
                {
                    selected.length > 1 ? boxLabel? boxLabel + ": Multiple" : "Multiple" : 
                    selected.length > 0 ? options.filter(x=>x.value===selected[0])[0].label : boxLabel || 'Select...'
                }
            </MenuButton>
            <MenuList>
                <MenuOptionGroup 
                    type="checkbox"
                    onChange={(v) => typeof(v)==="object" ?  (setValue?.(v) || setSelected(v)) : undefined} 
                    defaultValue={selected}
                    zIndex={1000}
                >
                    {options.length>1?options.map((option: SelectOption) => (
                        <MenuItemOption 
                            isChecked={selected.includes(option.value.toString())}
                            key={option.value} 
                            value={option.value.toString()}
                            bg={selected.includes(option.value.toString()) ? colors[typ+"3Quarter"] : ''}
                        >
                            {option.label}
                        </MenuItemOption>
                    )):null}
                </MenuOptionGroup>
            </MenuList>
        </Menu>
    );
};

export default FBMultiSelect;
