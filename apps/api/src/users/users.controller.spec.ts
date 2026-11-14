import { Role } from '../common/enums/role.enum';
import type { AccountDeletionService } from './account-deletion.service';
import { UsersController } from './users.controller';
import type { UsersService } from './users.service';
import type { WelcomeEmailService } from './welcome-email.service';

const user = { id: 'user-1', email: 'harbir@example.com', role: Role.USER };

function setUp({
  completedBefore = null as string | null,
  configured = true,
  tier = 'everything',
} = {}) {
  const usersService = {
    getProfile: jest.fn().mockResolvedValue({ onboardingCompletedAt: completedBefore }),
    updateProfile: jest.fn().mockResolvedValue({
      displayName: 'Harbir Bains',
      membershipTier: tier,
      onboardingCompletedAt: '2026-11-14T10:00:00.000Z',
    }),
  };
  const welcome = {
    isConfigured: jest.fn().mockReturnValue(configured),
    send: jest.fn().mockResolvedValue(undefined),
  };
  const controller = new UsersController(
    usersService as unknown as UsersService,
    {} as AccountDeletionService,
    welcome as unknown as WelcomeEmailService,
  );
  return { controller, usersService, welcome };
}

describe('UsersController.updateMe -- the welcome email', () => {
  it('sends it as onboarding is finished for the first time, after the save', async () => {
    const { controller, usersService, welcome } = setUp();

    const result = await controller.updateMe(user, { onboardingCompleted: true });

    expect(usersService.updateProfile).toHaveBeenCalledWith('user-1', {
      onboardingCompleted: true,
    });
    expect(welcome.send).toHaveBeenCalledWith({
      to: 'harbir@example.com',
      userId: 'user-1',
      name: 'Harbir Bains',
      nutrition: true,
    });
    expect(result.email).toBe('harbir@example.com');
  });

  it('never sends it again once onboarding was already done', async () => {
    const { controller, welcome } = setUp({ completedBefore: '2026-11-01T00:00:00.000Z' });
    await controller.updateMe(user, { onboardingCompleted: true });
    expect(welcome.send).not.toHaveBeenCalled();
  });

  it('sends nothing, and reads nothing extra, for any other save or while email is not set up', async () => {
    const other = setUp();
    await other.controller.updateMe(user, { displayName: 'Harbir' });
    expect(other.welcome.send).not.toHaveBeenCalled();
    expect(other.usersService.getProfile).not.toHaveBeenCalled();

    const unconfigured = setUp({ configured: false });
    await unconfigured.controller.updateMe(user, { onboardingCompleted: true });
    expect(unconfigured.welcome.send).not.toHaveBeenCalled();
    expect(unconfigured.usersService.getProfile).not.toHaveBeenCalled();
  });

  it('leaves meals out for a workouts-only membership', async () => {
    const { controller, welcome } = setUp({ tier: 'workouts' });
    await controller.updateMe(user, { onboardingCompleted: true });
    expect(welcome.send).toHaveBeenCalledWith(expect.objectContaining({ nutrition: false }));
  });
});
