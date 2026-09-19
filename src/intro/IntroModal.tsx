import React from 'react';
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  HStack,
  Box,
  Checkbox,
  Text,
} from '@chakra-ui/react';
import useAppColors from '../hooks/useAppColors';
import { stopPropagation } from '../components/common';
import FBButton from '../components/primitive/Button';
import { INTRO_STEPS } from './steps';

// Bump this when a change to the app is significant enough that returning
// users should see the walkthrough again. Stored (not a boolean) under
// useKvStore('prefs') key 'introSeenVersion' - see IntroModal's dismiss
// handler and nav-header.tsx's first-run check.
export const INTRO_VERSION = 3;
export const INTRO_SEEN_KEY = 'introSeenVersion';

interface IntroModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onDismiss: (dontShowAgain: boolean) => void;
}

const IntroModal: React.FC<IntroModalProps> = ({ isOpen, setIsOpen, onDismiss }) => {
  const [colors] = useAppColors();
  const [step, setStep] = React.useState(0);
  const [dontShowAgain, setDontShowAgain] = React.useState(true);

  const isLast = step === INTRO_STEPS.length - 1;
  const isFirst = step === 0;

  // reset to the first page whenever the modal is (re)opened, e.g. from the
  // help icon after the walkthrough was already dismissed once.
  React.useEffect(() => {
    if (isOpen) {
      setStep(0);
    }
  }, [isOpen]);

  const close = () => {
    onDismiss(dontShowAgain);
    setIsOpen(false);
  };

  const next = () => {
    if (isLast) {
      close();
    } else {
      setStep((s) => Math.min(s + 1, INTRO_STEPS.length - 1));
    }
  };

  const back = () => setStep((s) => Math.max(s - 1, 0));

  const current = INTRO_STEPS[step];

  return (
    <Modal isOpen={isOpen} onClose={close} size="3xl">
      <ModalOverlay />
      <ModalContent
        bgColor={colors.surfaceAlt}
        textColor={colors.fore}
                borderRadius="lg"
        borderColor={colors.border}
        borderWidth={1}
        onMouseDown={stopPropagation}
        onTouchStart={stopPropagation}
      >
        <ModalHeader
          borderBottomColor={colors.border}
          borderBottomWidth={1}
          fontSize={18}
        >
          Welcome to FastBoard — {current.title}
        </ModalHeader>
        <ModalCloseButton
          borderWidth={1}
          borderRadius="lg"
          borderColor={colors.border}
          _hover={{ bgColor: colors.surfaceSubtle, color: colors.fore }}
        />
        <ModalBody paddingTop={5} minH="220px">
          {current.render(colors)}
        </ModalBody>

        <ModalFooter>
          <HStack w="100%" justify="space-between" align="center">
            <HStack spacing={1}>
              {INTRO_STEPS.map((_, i) => (
                <Box
                  key={i}
                  w="8px"
                  h="8px"
                  borderRadius="50%"
                  bg={i === step ? colors.info : colors.foreQuarter}
                />
              ))}
            </HStack>

            <HStack spacing={4}>
              <Checkbox
                isChecked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                colorScheme="gray"
              >
                <Text fontSize="sm" color={colors.foreHalf}>
                  Don't show again
                </Text>
              </Checkbox>
              {!isFirst && (
                <FBButton typ="info" variant="outline" onClick={back}>
                  Back
                </FBButton>
              )}
              <FBButton typ="success" onClick={next}>
                {isLast ? 'Get started' : 'Next'}
              </FBButton>
            </HStack>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default IntroModal;
