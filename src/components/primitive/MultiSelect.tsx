import React, { useState, ChangeEvent } from 'react';
import { 
    Menu, MenuButton, MenuOptionGroup, MenuItemOption, MenuList, Button
} from '@chakra-ui/react';

import { componentType } from '../common';
import { SelectOption } from '../../interfaces';
import useAppColors from '../../hooks/colors';


interface FBMultiSelectProps {
    typ: componentType;
    setValue?: (value: string[] | string) => void;
    value?: string[];
    options: SelectOption[];
}

const FBMultiSelect: React.FC<FBMultiSelectProps> = ({ 
    typ, value, setValue, options, ...props 
}) => {
    const [selected, setSelected] = useState<string[] | string>(value || []);
    const colors = useAppColors();

    return (
        <Menu isLazy closeOnSelect={false}>
            <MenuButton 
                as={Button}
                borderRadius={0}
                borderWidth={1}
                textColor={colors.fore}
                borderColor={colors[typ+"Half"]}
                bg={colors.bg}
                _hover={{
                    borderColor: colors[typ],
                }}
                _active={{
                    borderColor: colors[typ],
                    bg: colors[typ+"Quarter"]
                }}
                w="100%"
                {...props}
            >
                {
                    selected.length > 1 ? "Multiple" : 
                    selected.length > 0 ? options.filter(x=>x.value===selected[0])[0].label : 'Select...'
                }
            </MenuButton>
            <MenuList>
                <MenuOptionGroup 
                    type="checkbox"
                    onChange={setValue || setSelected} defaultValue={selected}
                    zIndex={1000}
                >
                    {options.map((option: SelectOption) => (
                        <MenuItemOption 
                            isChecked={selected.includes(option.value.toString())}
                            key={option.value} 
                            value={option.value.toString()}
                            bg={selected.includes(option.value.toString()) ? colors[typ+"3Quarter"] : ''}
                        >
                            {option.label}
                        </MenuItemOption>
                    ))}
                </MenuOptionGroup>
            </MenuList>
        </Menu>
    );
};

export default FBMultiSelect;
