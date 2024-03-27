import React from "react";
import { 
    Slider, 
    SliderProps,
    SliderTrack,
    SliderFilledTrack,
    SliderThumb,
    SliderMark,
    Box,
    Tooltip

} from "@chakra-ui/react";
import useAppColors from "../../hooks/useAppColors";
import { componentType } from "../../interfaces";

interface FBSliderProps extends SliderProps {
    typ?: componentType
    icon?: React.FC<any>;
    leftUnitLabel?: string;
    rightUnitLabel?: string;
    marks?: number[];
    value?: number;
    setValue?: (value: number) => void;
}

const FBSlider: React.FC<FBSliderProps> = ({
    typ, icon, leftUnitLabel, rightUnitLabel, marks, setValue, value, ...props
}) => {
    const [colors] = useAppColors();
    typ = typ || "info";
    props.max = props.max || 100
    props.min = props.min || 0
    props.step = props.step || 5

    const [sliderValue, setSliderValue] = React.useState(value)
    const [showTooltip, setShowTooltip] = React.useState(false)
    
    return (
        <Slider 
            aria-label='slider-ex-1' 
            defaultValue={value || (props.max - props.min) / 2} 
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onChange={setValue ? (v) => setValue(v): props.onChange || setSliderValue}
            {...props}
        >
            {
                marks ? 
                    marks.map((markValue, index) => (
                        <SliderMark  
                            value={markValue} 
                            mt='1' 
                            ml='-2.5' 
                            fontSize='sm'
                        >
                            {leftUnitLabel||""}{markValue}{rightUnitLabel||""}
                        </SliderMark>
                    ))
                    : null
            }
            <SliderTrack>
                <SliderFilledTrack 
                    bg={colors[typ]}
                />
            </SliderTrack>
            <Tooltip
                hasArrow
                bg={colors[typ]}
                color='white'
                placement='top'
                isOpen={showTooltip}
                label={`${leftUnitLabel||""}${setValue?value:sliderValue}${rightUnitLabel||""}`}
            >
                {
                    icon ?
                        <SliderThumb boxSize={4} zIndex={0}>
                            <Box color={colors[typ]} as={icon}/>
                        </SliderThumb> 
                        : 
                        <SliderThumb  zIndex={0} />
                }

            </Tooltip>
        </Slider>
    )
};

export default FBSlider;
