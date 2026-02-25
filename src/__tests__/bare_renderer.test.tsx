import React from 'react';
import renderer from 'react-test-renderer';
import { View, Text } from 'react-native';

const SimpleComp = () => <View><Text>Hello</Text></View>;

describe('Simple Comp Test', () => {
  it('renders correctly', () => {
    const tree = renderer.create(<SimpleComp />).toJSON();
    expect(tree).toBeDefined();
  });
});
