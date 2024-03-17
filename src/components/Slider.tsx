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
import useAppColors from "../hooks/colors";
import { componentType } from "./common";

interface FBSliderProps extends SliderProps {
    typ: componentType
    icon?: React.FC<any>;
    leftUnitLabel?: string;
    rightUnitLabel?: string;
    marks?: number[];
}

const FBSlider: React.FC<FBSliderProps> = ({
    typ, icon, leftUnitLabel, rightUnitLabel, marks, ...props
}) => {
    const colors = useAppColors();

    const [sliderValue, setSliderValue] = React.useState(5)
    const [showTooltip, setShowTooltip] = React.useState(false)
    
    return (
        <Slider 
            aria-label='slider-ex-1' 
            defaultValue={sliderValue} 
            onChange={(v) => setSliderValue(v)}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
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
                label={`${leftUnitLabel||""}${sliderValue}${rightUnitLabel||""}`}
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
