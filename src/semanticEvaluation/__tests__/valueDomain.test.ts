import {
    arrayShapeValue,
    configuredCandidateSetValue,
    literalValue,
    mappingShapeValue,
    nonStaticValue,
    objectValue,
    unknownValue
} from '../valueFactories';
import { joinSemanticValues } from '../valueJoin';

describe('semantic evaluation value domain', () => {
    test('creates literal values', () => {
        expect(literalValue('login')).toEqual({
            kind: 'literal',
            valueType: 'string',
            value: 'login'
        });
    });

    test('creates exact object values', () => {
        expect(objectValue('/adm/protocol/model/login_model')).toEqual({
            kind: 'object',
            path: '/adm/protocol/model/login_model'
        });
    });

    test('creates configured candidate sets', () => {
        expect(configuredCandidateSetValue('this-player', [
            objectValue('/std/user'),
            objectValue('/std/player')
        ])).toEqual({
            kind: 'configured-candidate-set',
            provider: 'this-player',
            values: [
                {
                    kind: 'object',
                    path: '/std/user'
                },
                {
                    kind: 'object',
                    path: '/std/player'
                }
            ]
        });
    });

    test('distinguishes unknown and non-static values', () => {
        expect(unknownValue()).toEqual({
            kind: 'unknown'
        });

        expect(nonStaticValue('previous_object() depends on runtime call stack')).toEqual({
            kind: 'non-static',
            reason: 'previous_object() depends on runtime call stack'
        });
    });

    test('represents nested mapping and array static shapes', () => {
        expect(mappingShapeValue({
            login: mappingShapeValue({
                path: literalValue('/adm/protocol/model/login_model'),
                aliases: arrayShapeValue([
                    literalValue('login'),
                    literalValue('signin')
                ])
            })
        })).toEqual({
            kind: 'mapping-shape',
            entries: {
                login: {
                    kind: 'mapping-shape',
                    entries: {
                        path: {
                            kind: 'literal',
                            valueType: 'string',
                            value: '/adm/protocol/model/login_model'
                        },
                        aliases: {
                            kind: 'array-shape',
                            elements: [
                                {
                                    kind: 'literal',
                                    valueType: 'string',
                                    value: 'login'
                                },
                                {
                                    kind: 'literal',
                                    valueType: 'string',
                                    value: 'signin'
                                }
                            ]
                        }
                    }
                }
            }
        });
    });

    test('joins values into a de-duplicated union', () => {
        expect(joinSemanticValues([
            literalValue('login'),
            literalValue('login'),
            objectValue('/adm/protocol/model/login_model'),
            objectValue('/adm/protocol/model/login_model')
        ])).toEqual({
            kind: 'union',
            values: [
                {
                    kind: 'literal',
                    valueType: 'string',
                    value: 'login'
                },
                {
                    kind: 'object',
                    path: '/adm/protocol/model/login_model'
                }
            ]
        });
    });
});
