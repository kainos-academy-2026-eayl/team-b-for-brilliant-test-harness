export const Variables = {
    name: 'john',
    get uniqueEmail() {
        return `john${Date.now()}${Math.floor(Math.random() * 1e6)}@test.com`;
    },
    validPassword: 'testPassword',
    takenEmail: 'john@test2.com',
    phone: '0123456789',
    company: 'Kainos',
    accountEmail: 'john@test.com',
    fakeEmail: 'fake@fake.com',
    fakePassword: 'fakePassword123',
    shortEmail: 'a',
    shortPassword: 'a',
    fakeToken: 'fake',
};
