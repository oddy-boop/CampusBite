
import React, { useRef, useEffect } from 'react';\nimport { Platform, Keyboard, KeyboardAvoidingView, Animated } from 'react-native';\n\nconst KeyboardAvoidingAnimatedView = (props, ref) => {\n  const {\n    children,\n    behavior = Platform.OS === 'ios' ? 'padding' : 'height',\n    keyboardVerticalOffset = 0,\n    style,\n    contentContainerStyle,\n    enabled = true,\n    onLayout,\n    ...leftoverProps\n  } = props;\n\n  const animatedViewRef = useRef(null); // ref to animated view in this polyfill\n  const initialHeightRef = useRef(0); // original height of animated view before keyboard appears\n  const bottomRef = useRef(0); // current bottom offset value of animated view\n  const bottomHeight = useRef(new Animated.Value(0)).current; // whats going to be added to the bottom when keyboard appears\n\n  useEffect(() => {\n    if (!enabled) return;\n\n    const onKeyboardShow = (event) => {\n      const { duration, endCoordinates } = event;\n      const animatedView = animatedViewRef.current;

      if (!animatedView) return;

      let height = 0;

      // calculate how much the view needs to move up
      const keyboardY = endCoordinates.screenY - keyboardVerticalOffset;
      height = Math.max(animatedView.y + animatedView.height - keyboardY, 0);

      bottomHeight.value = withTiming(height, {
        duration: duration > 10 ? duration : 300,
      });
      bottomRef.current = height;
    };

    const onKeyboardHide = () => {
      bottomHeight.value = withTiming(0, { duration: 300 });
      bottomRef.current = 0;
    };

    Keyboard.addListener('keyboardWillShow', onKeyboardShow);
    Keyboard.addListener('keyboardWillHide', onKeyboardHide);

    return () => {
      Keyboard.removeAllListeners('keyboardWillShow');
      Keyboard.removeAllListeners('keyboardWillHide');
    };
  }, [keyboardVerticalOffset, enabled, bottomHeight]);

  const animatedStyle = useAnimatedStyle(() => {
    if (behavior === 'height') {
      return {
        height: initialHeightRef.current - bottomHeight.value,
        flex: bottomHeight.value > 0 ? 0 : null,
      };
    }
    if (behavior === 'padding') {
      return {
        paddingBottom: bottomHeight.value,
      };
    }
    return {};
  });

  const positionAnimatedStyle = useAnimatedStyle(() => ({
    bottom: bottomHeight.value,
  }));

  const handleLayout = (event) => {
    const layout = event.nativeEvent.layout;
    animatedViewRef.current = layout;

    // initial height before keybaord appears
    if (!initialHeightRef.current) {
      initialHeightRef.current = layout.height;
    }

    if (onLayout) {
      onLayout(event);
    }
  };

  const renderContent = () => {
    if (behavior === 'position') {
      return (
        <Animated.View
          style={[
            contentContainerStyle,
            positionAnimatedStyle,
          ]}
        >
          {children}
        </Animated.View>
      );
    }
    // render children if padding or height
    return children;
  };

  // for web, default to unused keyboard avoiding view
  if (Platform.OS === 'web') {
    return (
      <KeyboardAvoidingView
        behavior={behavior}
        style={style}
        contentContainerStyle={contentContainerStyle}
        {...leftoverProps}
      >
        {children}
      </KeyboardAvoidingView>
    );
  }

  return (
    <Animated.View
      ref={ref}
      style={[style, animatedStyle]}
      onLayout={handleLayout}
      {...leftoverProps}
    >
      {renderContent()}
    </Animated.View>
  );
};

KeyboardAvoidingAnimatedView.displayName = 'KeyboardAvoidingAnimatedView';

export default KeyboardAvoidingAnimatedView;
