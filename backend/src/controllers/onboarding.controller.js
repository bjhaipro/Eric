import { getOnboarding, setOnboardingDismissed } from "../services/onboarding.service.js";

export async function get(req, res, next) {
  try {
    res.json(await getOnboarding(req.user.id));
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    res.json(await setOnboardingDismissed(req.user.id, req.body.dismissed));
  } catch (error) {
    next(error);
  }
}
