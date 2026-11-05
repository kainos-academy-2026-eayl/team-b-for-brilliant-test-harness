import { test as base } from '@playwright/test';
import { Variables } from './Variables';

export type testOptions = {
    login: (email?: string, password?: string) => Promise<any>;
    register: (name?: string, email?: string, password?: string) => Promise<any>;
    updateProfile: (name: string, phone: string, company: string) => Promise<any>;
    viewProfile: (token?: string) => Promise<any>;
};

export const test = base.extend<testOptions>({
    login: async ({ request }, use) => {
        await use(async (
            email = Variables.accountEmail,
            password = Variables.validPassword
        ) => {
            const response = await request.post('/login', {
                data: {
                    email,
                    password
                }
            });

            return response;
        });
    },
    register: async ({ request }, use) => {
        await use(async (
            name = Variables.name,
            email = Variables.uniqueEmail,
            password = Variables.validPassword
        ) => {
            const response = await request.post('/register', {
                data: {
                    name,
                    email,
                    password
                }
            });

            return response;
        });
    },
    updateProfile: async ({ request }, use) => {
        await use(async (name, phone, company) => {
            const response = await request.patch('/account', {
                data: {
                    name,
                    phone,
                    company
                }
            });

            return response;
        });
    },
    viewProfile: async ({ request }, use) => {
        await use(async (
            token = '40e8deecf88e4aee85d385ecef85ace34abb2d6e5829466da6d5d409100a8281'
        ) => {
            return request.get('/account', {
                headers: {
                    'x-auth-token': token
                }
            });
        });
    }
});