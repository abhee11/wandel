import {it,expect,vi,beforeEach} from 'vitest';
const mocks=vi.hoisted(()=>({verify:vi.fn(),user:vi.fn()}));
vi.mock('@clerk/backend',()=>({verifyToken:mocks.verify,createClerkClient:()=>({users:{getUser:mocks.user}})}));
import {ClerkIdentity} from '../platform/server/clerk';
const extension='chrome-extension://ofigoahnponclbbhfihlieciodlnphlk';
const identity=new ClerkIdentity('test-secret',['https://wandel.example',extension]);
beforeEach(()=>{vi.clearAllMocks();mocks.verify.mockResolvedValue({sub:'user_1'});mocks.user.mockResolvedValue({id:'user_1',primaryEmailAddressId:'email_1',emailAddresses:[{id:'email_1',emailAddress:'test@example.com',verification:{status:'verified'}}]});});
it('accepts a verified worker token without azp for origin-less requests or the configured extension',async()=>{
 await expect(identity.verify('token',extension)).resolves.toMatchObject({subject:'user_1'});
 await expect(identity.verify('token')).resolves.toMatchObject({subject:'user_1'});
 for(const origin of ['null','https://wandel.example','https://evil.example','chrome-extension://other'])await expect(identity.verify('token',origin)).rejects.toMatchObject({code:'AUTH_ORIGIN_MISMATCH'});
});
it('rejects a present unauthorized party even for the configured extension',async()=>{
 mocks.verify.mockResolvedValue({sub:'user_1',azp:'https://evil.example'});
 await expect(identity.verify('token',extension)).rejects.toMatchObject({code:'AUTH_ORIGIN_MISMATCH'});expect(mocks.user).not.toHaveBeenCalled();
});
it('accepts the web origin and never accepts a token with failed signature validation',async()=>{
 mocks.verify.mockResolvedValueOnce({sub:'user_1',azp:'https://wandel.example'});
 await expect(identity.verify('token')).resolves.toMatchObject({subject:'user_1'});
 mocks.user.mockClear();mocks.verify.mockRejectedValueOnce(new Error('Invalid signature'));
 await expect(identity.verify('invalid',extension)).rejects.toMatchObject({code:'AUTH_REQUIRED'});expect(mocks.user).not.toHaveBeenCalled();
});
