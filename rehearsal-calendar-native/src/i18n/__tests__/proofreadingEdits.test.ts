/**
 * Every edit the native speakers of T-256 made to the app's screens, one by one
 * (the owner's rule after the second review, 13.11.2026): the new wording stands
 * in its key, and the old one — the editor's "Сейчас" — is nowhere in that
 * language any more, so a wording brought back by a merge or a copy is caught
 * here even where no flow walks to it. Flows hold what a person sees on the
 * phone; this holds every word. One run names every edit that is not in.
 *
 * "After" is the wording now: where the second reading (T-261) changed a T-256
 * edit again, its row has the newer one, and T-261 has its own rows below.
 *
 * A function is called with the arguments of its row: a name where it takes a
 * name, numbers where the number chooses the words (one row per wording).
 */
import * as fs from 'fs';
import * as path from 'path';
import { translations } from '../translations';

type Lang = 'ru' | 'en' | 'es' | 'de';
type Args = Array<string | number> | null;
type Edit = [Lang, string, Args, string, string];

// [language, key, arguments, before (3b16cd5), after]
const EDITS: Edit[] = [
  // ru
  ['ru', 'common.cancel', null, 'Отмена', 'Отменить'],
  ['ru', 'common.loading', null, 'Загрузка...', 'Загрузка…'],
  ['ru', 'common.from', null, 'От:', 'С:'],
  ['ru', 'common.to', null, 'До:', 'По:'],
  ['ru', 'actionSheet.title', null, 'Новое действие', 'Добавить'],
  ['ru', 'auth.googleAccountLinkedToExisting', null, 'Ваш аккаунт Google был связан с существующим аккаунтом.', 'Аккаунт Google привязан к вашему аккаунту Rehearsly.'],
  ['ru', 'auth.appleAccountLinkedToExisting', null, 'Ваш аккаунт Apple был связан с существующим аккаунтом.', 'Аккаунт Apple привязан к вашему аккаунту Rehearsly.'],
  ['ru', 'auth.codeExpired', null, 'Срок кода истёк. Запросите новый.', 'Срок действия кода истёк. Запросите новый.'],
  ['ru', 'auth.emailUnavailable', null, 'Почта сейчас недоступна. Попробуйте позже.', 'Сейчас не получается отправить письмо. Попробуйте позже.'],
  ['ru', 'auth.backToLogin', null, 'Ко входу', 'Вернуться ко входу'],
  ['ru', 'auth.verifySubtitleUnsent', ['Anna', 'Hamlet', 'Planner'], 'Аккаунт создан. Чтобы войти, подтвердите Anna кодом из письма.', 'Аккаунт создан. Чтобы войти, подтвердите адрес Anna кодом из письма.'],
  ['ru', 'auth.timezoneInvalid', null, 'Часовой пояс устройства не распознан. Проверьте его в настройках.', 'Часовой пояс телефона не распознан. Проверьте настройки даты и времени.'],
  ['ru', 'auth.noConnection', null, 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз', 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.'],
  ['ru', 'auth.requestFailed', null, 'Что-то пошло не так. Попробуйте ещё раз', 'Что-то пошло не так. Попробуйте ещё раз.'],
  ['ru', 'calendar.needProject', null, 'Репетиции появятся, когда вы окажетесь в проекте', 'Репетиции появятся, когда вы будете в проекте'],
  ['ru', 'calendar.loading', null, 'Загрузка репетиций...', 'Загрузка репетиций…'],
  ['ru', 'calendar.smartPlannerSubtitle', null, 'Найти оптимальное время для репетиции', 'Подобрать время для репетиции'],
  ['ru', 'rehearsals.editRehearsal', null, 'Редактировать репетицию', 'Изменить репетицию'],
  ['ru', 'rehearsals.deleteNotifies', [1, 1], 'Участники (1) получат уведомление', 'Уведомление получит 1 участник'],
  ['ru', 'rehearsals.deleteNotifies', [2, 3], 'Участники (2) получат уведомление', 'Уведомление получат 2 участника'],
  ['ru', 'rehearsals.deleteNotifies', [5, 5], 'Участники (5) получат уведомление', 'Уведомление получат 5 участников'],
  ['ru', 'rehearsals.deleteNotifiedUnknown', null, 'Не удалось узнать, кто получит уведомление об отмене. Проверьте соединение и повторите.', 'Не удалось узнать, кто получит уведомление об отмене. Проверьте соединение и попробуйте ещё раз.'],
  ['ru', 'rehearsals.scheduleConflict', null, '⚠️ Конфликт расписания', '⚠️ Накладка в расписании'],
  ['ru', 'rehearsals.updateError', null, 'Не удалось обновить репетицию', 'Не удалось сохранить изменения'],
  ['ru', 'rehearsals.seenError', null, 'Не удалось отметить просмотр', 'Не удалось отметить как просмотренное'],
  ['ru', 'rehearsals.markSeen', null, 'Отметить просмотренным', 'Отметить как просмотренное'],
  ['ru', 'rehearsals.loadingMembers', null, 'Загрузка участников...', 'Загрузка участников…'],
  ['ru', 'projects.joinByCode', null, 'Вступить в проект', 'Присоединиться к проекту'],
  ['ru', 'projects.shareInviteMessage', ['Anna', 'Hamlet', 'Planner'], 'Присоединяйся к проекту «Anna» в приложении Rehearsly:', 'Присоединяйтесь к проекту «Anna» в приложении Rehearsly:'],
  ['ru', 'projects.shareInviteTitle', ['Anna', 'Hamlet', 'Planner'], 'Приглашение в проект Anna', 'Приглашение в проект «Anna»'],
  ['ru', 'projects.cancel', null, 'Отмена', 'Отменить'],
  ['ru', 'projects.deleteProjectWarning', null, 'Все репетиции, участники и данные проекта будут удалены без возможности восстановления.', 'Все репетиции и данные проекта будут удалены безвозвратно, а участники потеряют к нему доступ.'],
  ['ru', 'projects.loadingInvite', null, 'Загрузка приглашения...', 'Загрузка приглашения…'],
  ['ru', 'profile.reportBugPlaceholder', null, 'Опишите проблему...', 'Опишите проблему…'],
  ['ru', 'profile.cancel', null, 'Отмена', 'Отменить'],
  ['ru', 'profile.pushDeniedTitle', null, 'Уведомления запрещены', 'Уведомления не разрешены'],
  ['ru', 'profile.timezoneError', null, 'Не удалось обновить часовой пояс', 'Не удалось изменить часовой пояс'],
  ['ru', 'profile.weekStartError', null, 'Не удалось обновить начало недели', 'Не удалось изменить начало недели'],
  ['ru', 'profile.emailChanged', ['Anna', 'Hamlet', 'Planner'], 'Теперь вы входите с Anna. На прежний адрес отправлено уведомление.', 'Теперь вы входите с адресом Anna. На прежний адрес отправлено уведомление.'],
  ['ru', 'availability.addSlot', null, 'Добавить слот', 'Добавить время'],
  ['ru', 'availability.invalidSlot', null, 'Пожалуйста, исправьте время слотов и попробуйте снова.', 'Исправьте время и попробуйте снова.'],
  ['ru', 'availability.slotsOverlap', null, 'Слоты не должны пересекаться', 'Промежутки времени не должны пересекаться'],
  ['ru', 'availability.slotSameStartEnd', null, 'Время окончания не может совпадать с началом', 'Время окончания не может совпадать со временем начала'],
  ['ru', 'availability.fixSlots', null, 'Пожалуйста, исправьте время слотов и попробуйте снова.', 'Исправьте время и попробуйте снова.'],
  ['ru', 'smartPlanner.analyzing', null, 'Смотрим, кто свободен...', 'Смотрим, кто свободен…'],
  ['ru', 'smartPlanner.noSlotsMessage', null, 'Здесь появляются часы, когда свободна вся команда. Для этого участники должны отметить свою занятость — или попробуйте другой период.', 'Здесь появляются часы, когда свободны все участники. Для этого им нужно отметить занятость. Или попробуйте другой период.'],
  ['ru', 'smartPlanner.slotsCount', [1, 1], '1 слот', '1 вариант'],
  ['ru', 'smartPlanner.slotsCount', [2, 3], '2 слота', '2 варианта'],
  ['ru', 'smartPlanner.slotsCount', [5, 5], '5 слотов', '5 вариантов'],
  ['ru', 'smartPlanner.unknownAvailability', ['Anna', 'Hamlet', 'Planner'], 'Нет данных о занятости: Anna. В расчёте они считаются свободными.', 'Нет данных о занятости: Anna. Без отметок участник считается свободным.'],
  ['ru', 'calendarSync.grantPermission', null, 'Предоставить доступ', 'Разрешить доступ'],
  ['ru', 'calendarSync.checkingPermissions', null, 'Проверка разрешений...', 'Проверка разрешений…'],
  ['ru', 'calendarSync.removeAll', null, 'Удалить экспортированные репетиции', 'Удалить репетиции из календаря'],
  ['ru', 'calendarSync.removeAllConfirm', null, 'Удалить все репетиции из календаря?', 'Удалить все репетиции из календаря телефона?'],
  ['ru', 'calendarSync.removeAllSuccess', null, 'Все репетиции удалены из календаря', 'Все репетиции удалены из календаря телефона'],
  ['ru', 'calendarSync.exportIncomplete', ['Anna', 'Hamlet', 'Planner'], 'Не удалось записать в календарь репетиций: Anna.', 'Не удалось записать репетиций в календарь: Anna.'],
  ['ru', 'calendarSync.daysAgo', [1, 1], '1 дн. назад', 'вчера'],
  ['ru', 'notifications.markAllRead', null, 'Отметить все', 'Прочитать все'],
  ['ru', 'onboarding.skipMessage', null, 'Вы сможете настроить день начала недели и синхронизацию календаря в любое время в разделе Профиль → Настройки', 'Вы сможете настроить начало недели и синхронизацию календаря в любое время в разделе «Профиль» → «Настройки».'],
  ['ru', 'onboarding.notifications.description', null, 'Придёт сообщение, когда вас позовут на репетицию или когда её время изменится. Без них об изменении легко узнать последним.', 'Придёт уведомление, когда вас позовут на репетицию или изменят её время. Без уведомлений легко узнать об изменениях позже всех.'],
  ['ru', 'onboarding.notifications.exampleAdded', null, 'Вас добавили в репетицию', 'Вас позвали на репетицию'],
  ['ru', 'onboarding.calendarSync.google', null, 'Google Calendar', 'Google Календарь'],
  ['ru', 'onboarding.calendarSync.apple', null, 'Apple Calendar', 'Календарь iPhone'],
  ['ru', 'onboarding.calendarSync.grantPermission', null, 'Предоставить доступ', 'Разрешить доступ'],
  // en
  ['en', 'common.loading', null, 'Loading...', 'Loading…'],
  ['en', 'common.noConnection', null, 'No connection. Check the internet and try again.', 'Could not connect. Check your internet connection and try again.'],
  ['en', 'common.selectPeriod', null, 'Select Period', 'Select Dates'],
  ['en', 'common.dateRangeTooLong', [1, 1], 'Choose a range of up to 1 days, including the first and last day.', 'Choose a range of up to 1 day, including the first and last day.'],
  ['en', 'common.dontSave', null, 'Don\'t Save', 'Don’t Save'],
  ['en', 'actionSheet.title', null, 'New Action', 'Quick Actions'],
  ['en', 'auth.passwordHint', [1, 1], 'At least 1 characters', 'At least 1 character'],
  ['en', 'auth.confirmPasswordPlaceholder', null, 'Repeat password', 'Re-enter password'],
  ['en', 'auth.googleAccountLinkedToExisting', null, 'Your Google account has been linked to your existing account.', 'Your Google Account has been linked to your existing account.'],
  ['en', 'auth.appleAccountLinkedToExisting', null, 'Your Apple account has been linked to your existing account.', 'Your Apple Account has been linked to your existing account.'],
  ['en', 'auth.resendIn', [1, 1], 'You can ask for a new code in 1 s', 'You can ask for a new code in 1 second'],
  ['en', 'auth.resendIn', [2, 3], 'You can ask for a new code in 2 s', 'You can ask for a new code in 2 seconds'],
  ['en', 'auth.codeLocked', null, 'Too many wrong attempts. Ask for a new code.', 'Too many failed attempts. Ask for a new code.'],
  ['en', 'auth.emailUnavailable', null, 'Email is unavailable right now. Try again later.', 'Emails cannot be sent right now. Try again later.'],
  ['en', 'auth.rateLimited', [1, 1], 'Wait 1 s and try again.', 'Wait 1 second and try again.'],
  ['en', 'auth.rateLimited', [2, 3], 'Wait 2 s and try again.', 'Wait 2 seconds and try again.'],
  ['en', 'auth.emailTakenTitle', null, 'Address Already in Use', 'Email Already in Use'],
  ['en', 'auth.emailNotVerified', null, 'Confirm your address first: enter the code from the email.', 'Confirm your email address first: enter the code from the email.'],
  ['en', 'auth.verifySubtitleUnsent', ['Anna', 'Hamlet', 'Planner'], 'Your account is created. To sign in, confirm Anna with the code from the email.', 'Your account has been created. To sign in, confirm Anna with the code from the email.'],
  ['en', 'auth.passwordRule', null, 'Password: at least 8 characters and at most 72 bytes — 72 Latin letters, fewer in other scripts.', 'Password: at least 8 characters and at most 72 bytes — 72 letters A–Z, fewer with accents or other scripts.'],
  ['en', 'auth.nameInvalid', null, 'A first name is required; first and last name are at most 100 characters.', 'First name is required. First and last names can each be up to 100 characters.'],
  ['en', 'auth.timezoneInvalid', null, 'The device\'s time zone was not recognized. Check it in Settings.', 'The device’s time zone was not recognized. Check it in Settings.'],
  ['en', 'auth.resetSubtitle', null, 'Enter your account’s email address and we will send a code to it.', 'Enter your account’s email address, and we will send you a code.'],
  ['en', 'auth.resetCodeSent', ['Anna', 'Hamlet', 'Planner'], 'If Anna has an account, a six-digit code is on its way there. Enter it and a new password.', 'If an account exists for Anna, a six-digit code is on its way. Enter it along with a new password.'],
  ['en', 'auth.newPassword', null, 'New password', 'New Password'],
  ['en', 'auth.otherAddress', null, 'Another Address', 'Use Another Email'],
  ['en', 'auth.noConnection', null, 'No connection to the server. Check your internet connection and try again', 'Could not connect to the server. Check your internet connection and try again.'],
  ['en', 'auth.requestFailed', null, 'Something went wrong. Try again', 'Something went wrong. Try again.'],
  ['en', 'calendar.loading', null, 'Loading rehearsals...', 'Loading rehearsals…'],
  ['en', 'rehearsals.deleteNotifies', [1, 1], 'Participants (1) will be notified', '1 participant will be notified'],
  ['en', 'rehearsals.deleteNotifies', [2, 3], 'Participants (2) will be notified', '2 participants will be notified'],
  ['en', 'rehearsals.deleteNotifiedUnknown', null, 'Could not find out who will be told it is cancelled. Check your connection and try again.', 'Could not find out who will be notified. Check your connection and try again.'],
  ['en', 'rehearsals.loadMembersError', null, 'Failed to load project members', 'Could not load project members'],
  ['en', 'rehearsals.loadAvailabilityError', null, 'Failed to load member availability', 'Could not load member availability'],
  ['en', 'rehearsals.busyAtThisTime', ['Anna, Hamlet', 2], 'Anna, Hamlet are busy at this time', 'Busy at this time: Anna, Hamlet'],
  ['en', 'rehearsals.rehearsalUpdated', null, 'Rehearsal updated successfully', 'Rehearsal saved'],
  ['en', 'rehearsals.updateError', null, 'Failed to update rehearsal', 'Could not save the rehearsal'],
  ['en', 'rehearsals.availabilityChecking', null, 'The participants\' availability for this day is still being checked.', 'The participants’ availability for this day is still being checked.'],
  ['en', 'rehearsals.notOnRoster', null, 'You are not in the cast', 'Not on this rehearsal'],
  ['en', 'rehearsals.loadingMembers', null, 'Loading members...', 'Loading members…'],
  ['en', 'rehearsals.noMembers', null, 'No members in project', 'No members in this project'],
  ['en', 'rehearsals.busyAt', ['Anna', 'Hamlet', 'Planner'], 'Anna busy Hamlet', 'Busy: Anna (Hamlet)'],
  ['en', 'rehearsals.notFound', null, 'This rehearsal is not available. It may have been deleted, or you were taken off it.', 'This rehearsal is not available. It may have been deleted, or you may have been taken off it.'],
  ['en', 'projects.inviteLinkError', null, 'Failed to create invite link', 'Could not create the invite link'],
  ['en', 'projects.fetchError', null, 'Failed to load project data', 'Could not load the project'],
  ['en', 'projects.inviteCodeLabel', null, 'Invite code', 'Invite Code'],
  ['en', 'projects.memberActionError', null, 'Failed to perform action', 'Could not complete the action'],
  ['en', 'projects.deleteProjectWarning', null, 'All rehearsals, members, and project data will be permanently deleted.', 'All rehearsals, the member list, and other project data will be permanently deleted.'],
  ['en', 'projects.projectDeleted', null, 'Project successfully deleted', 'Project deleted'],
  ['en', 'projects.deleteProjectError', null, 'Failed to delete project', 'Could not delete the project'],
  ['en', 'projects.inviteLoadError', null, 'Failed to load invitation info', 'Could not load the invitation'],
  ['en', 'projects.joinError', null, 'Failed to join project', 'Could not join the project'],
  ['en', 'projects.loadingInvite', null, 'Loading invitation...', 'Loading invitation…'],
  ['en', 'profile.timezoneNotFound', null, 'Nothing found', 'No Results'],
  ['en', 'profile.weekStart', null, 'Week starts on', 'Start Week On'],
  ['en', 'profile.reportBugPlaceholder', null, 'Describe the issue...', 'Describe the issue…'],
  ['en', 'profile.deleteAccountWarning', null, 'This action is irreversible. All your data will be permanently deleted — along with the projects you own and all their rehearsals. Everyone else in them will lose them too.', 'This cannot be undone. All your data will be permanently deleted, along with the projects you own and all their rehearsals. Other members of those projects will lose them too.'],
  ['en', 'profile.deleteAccountError', null, 'Failed to delete account', 'Could not delete your account'],
  ['en', 'profile.updateError', null, 'Failed to update profile', 'Could not update your profile'],
  ['en', 'profile.avatarHint', null, 'Avatar is automatically generated based on your email', 'Your avatar is created automatically from your initials.'], // T-272: the avatar is the initials, never the email
  ['en', 'profile.notificationError', null, 'Failed to update notification settings', 'Could not update notification settings'],
  ['en', 'profile.pushDeniedMessage', null, 'Allow notifications for Rehearsly in your phone settings.', 'Allow notifications for Rehearsly in Settings.'],
  ['en', 'profile.languageError', null, 'Failed to change language', 'Could not change the language'],
  ['en', 'profile.timezoneError', null, 'Failed to update time zone', 'Could not update the time zone'],
  ['en', 'profile.weekStartError', null, 'Failed to update week start day', 'Could not change the first day of the week'],
  ['en', 'profile.changeEmail', null, 'Change Address', 'Change Email'],
  ['en', 'profile.changeEmailTitle', null, 'Change Address', 'Change Email'],
  ['en', 'profile.newEmail', null, 'New address', 'New Email'],
  ['en', 'profile.currentPassword', null, 'Current password', 'Current Password'],
  ['en', 'profile.currentAddressCode', ['Anna', 'Hamlet', 'Planner'], 'Code from the email to Anna', 'Code sent to Anna'],
  ['en', 'profile.newAddressCode', ['Anna', 'Hamlet', 'Planner'], 'Code from the email to Anna', 'Code sent to Anna'],
  ['en', 'profile.emailChangedTitle', null, 'Address Changed', 'Email Changed'],
  ['en', 'availability.couldNotLoad', null, 'No connection. Showing what loaded last — your entries are safe.', 'Could not connect. Showing what was last loaded — your entries are safe.'],
  ['en', 'availability.lastLoadedShown', null, 'Showing what loaded last — your entries are safe.', 'Showing what was last loaded — your entries are safe.'],
  ['en', 'availability.saveError', null, 'Failed to save availability', 'Could not save your availability'],
  ['en', 'availability.busyTime', null, 'Busy time', 'Busy Time'],
  ['en', 'availability.fromCalendar', null, 'Already on this day', 'Already Scheduled'],
  ['en', 'availability.startTime', null, 'Start time', 'Start Time'],
  ['en', 'availability.endTime', null, 'End time', 'End Time'],
  ['en', 'availability.understood', null, 'Understood', 'OK'],
  ['en', 'availability.busyAllDay', null, 'You are unavailable on this day', 'You are busy all day'],
  ['en', 'smartPlanner.analyzing', null, 'Analyzing availability...', 'Analyzing availability…'],
  ['en', 'smartPlanner.noSlots', null, 'Nothing to show yet', 'Nothing to Show Yet'],
  ['en', 'smartPlanner.noSlotsMessage', null, 'Hours when everyone is free show up here. For that, people need to mark when they are busy — or try another period.', 'Hours when everyone is free show up here once people mark when they are busy. You can also try different dates.'],
  ['en', 'smartPlanner.errorLoading', null, 'Error loading', 'Could not load availability'],
  ['en', 'smartPlanner.addRehearsalAt', ['Anna', 'Hamlet', 'Planner'], 'Add rehearsal Anna', 'Add rehearsal, Anna'],
  ['en', 'smartPlanner.allMembers', null, 'All Members', 'All participants'],
  ['en', 'calendarSync.explanation', null, 'Rehearsals go into your phone’s calendar, and only the hours you are busy come back from it, never what the events are.', 'Rehearsals go into your phone’s calendar, and only the hours you are busy come back from it — never the details of your events.'],
  ['en', 'calendarSync.permissionRequired', null, 'Calendar access required', 'Calendar Access Required'],
  ['en', 'calendarSync.checkingPermissions', null, 'Checking permissions...', 'Checking permissions…'],
  ['en', 'calendarSync.removeAll', null, 'Remove All Exported', 'Remove Exported Rehearsals'],
  ['en', 'calendarSync.syncSuccess', null, 'Synced successfully', 'Synced'],
  ['en', 'calendarSync.removeAllPartial', [1, 1], 'Removed: 1. Could not remove: 1 — those events are still in the calendar.', 'Removed: 1. Could not remove: 1 — that event is still in the calendar.'],
  ['en', 'calendarSync.noWritableCalendars', null, 'No writable calendars', 'No editable calendars'],
  ['en', 'calendarSync.synchronize', null, 'Synchronize', 'Sync Now'],
  ['en', 'notifications.empty', null, 'Nothing yet', 'No Notifications Yet'],
  ['en', 'notifications.markAllRead', null, 'Mark all read', 'Mark All Read'],
  ['en', 'notifications.clearAllConfirmBody', null, 'The list will be empty. This cannot be undone.', 'All notifications will be deleted. This cannot be undone.'],
  ['en', 'onboarding.skipMessage', null, 'You can set the first day of the week and calendar sync at any time in Profile → Settings', 'You can choose the first day of the week and set up calendar sync at any time in Profile → Settings.'],
  ['en', 'onboarding.welcome.feature3', null, 'The rehearsal lands in everyone\'s calendar', 'The rehearsal lands in everyone’s calendar'],
  ['en', 'onboarding.notifications.description', null, 'You will hear when someone puts you on a rehearsal, and when its time changes. Without them, you find out last.', 'You will hear when someone puts you on a rehearsal or its time changes. Without notifications, you may be the last to know.'],
  ['en', 'onboarding.notifications.exampleAdded', null, 'You were added to a rehearsal', 'You Were Added to a Rehearsal'],
  ['en', 'onboarding.notifications.exampleTimeChanged', null, 'A rehearsal’s time changed', 'Rehearsal Time Changed'],
  ['en', 'onboarding.calendarSync.description', null, 'Your company sees only the hours you are busy, never what you are doing. Pick a calendar on your phone and those hours come across on their own.', 'Your team sees only the hours you are busy, never what you are doing. Pick a calendar on your phone, and those hours will be added automatically.'],
  ['en', 'onboarding.whatWhere.planner', null, 'Finding a time', 'Finding a Time'],
  // es
  ['es', 'common.loading', null, 'Cargando...', 'Cargando…'],
  ['es', 'common.noConnection', null, 'Sin conexión. Comprueba tu conexión a internet e inténtalo de nuevo.', 'Sin conexión. Comprueba que tienes internet e inténtalo de nuevo.'],
  ['es', 'common.done', null, 'Listo', 'OK'],
  ['es', 'auth.verifySubtitle', ['Anna', 'Hamlet', 'Planner'], 'Enviamos un código de seis dígitos a Anna. Introdúcelo para entrar.', 'Enviamos un código de seis dígitos a Anna. Escríbelo para entrar.'],
  ['es', 'auth.resendCode', null, 'Enviar el código otra vez', 'Reenviar código'],
  ['es', 'auth.emailUnavailable', null, 'El correo no está disponible ahora. Inténtalo más tarde.', 'Ahora no podemos enviar correos. Inténtalo más tarde.'],
  ['es', 'auth.emailNotVerified', null, 'Primero confirma tu dirección: introduce el código del correo.', 'Primero confirma tu dirección: escribe el código del correo.'],
  ['es', 'auth.passwordRule', null, 'Contraseña: al menos 8 caracteres y como máximo 72 bytes — 72 letras latinas, menos con acentos u otros alfabetos.', 'Contraseña: al menos 8 caracteres y como máximo 72 bytes (72 letras sin tilde; menos si usas tildes, ñ u otros alfabetos).'],
  ['es', 'auth.nameInvalid', null, 'El nombre es obligatorio; nombre y apellido tienen como máximo 100 caracteres.', 'El nombre es obligatorio; el nombre y el apellido no pueden superar los 100 caracteres.'],
  ['es', 'auth.timezoneInvalid', null, 'No se reconoció la zona horaria del dispositivo. Revísala en Ajustes.', 'No se reconoció la zona horaria del teléfono. Revísala en la configuración de fecha y hora.'],
  ['es', 'auth.resetSubtitle', null, 'Introduce la dirección de tu cuenta y te enviaremos un código.', 'Escribe la dirección de tu cuenta y te enviaremos un código.'],
  ['es', 'auth.resetCodeSent', ['Anna', 'Hamlet', 'Planner'], 'Si Anna tiene una cuenta, le hemos enviado un código de seis dígitos. Introdúcelo junto con una contraseña nueva.', 'Si hay una cuenta con Anna, te enviamos un código de seis dígitos a esa dirección. Escríbelo junto con una contraseña nueva.'],
  ['es', 'auth.noConnection', null, 'Sin conexión con el servidor. Comprueba tu conexión a internet e inténtalo de nuevo', 'No hay conexión con el servidor. Comprueba que tienes internet e inténtalo de nuevo.'],
  ['es', 'calendar.loading', null, 'Cargando ensayos...', 'Cargando ensayos…'],
  ['es', 'rehearsals.deleteNotifies', [1, 1], 'Los participantes (1) recibirán un aviso', '1 participante recibirá una notificación'],
  ['es', 'rehearsals.deleteNotifies', [2, 3], 'Los participantes (2) recibirán un aviso', '2 participantes recibirán una notificación'],
  ['es', 'rehearsals.notOnRoster', null, 'No estás en el reparto', 'No estás en este ensayo'],
  ['es', 'rehearsals.seenCount', ['Anna', 'Hamlet', 'Planner'], 'Vistos: Anna', 'Lo han visto: Anna'],
  ['es', 'rehearsals.loadingMembers', null, 'Cargando miembros...', 'Cargando miembros…'],
  ['es', 'projects.namePlaceholder', null, 'Introduce el nombre', 'Escribe el nombre'],
  ['es', 'projects.descriptionPlaceholder', null, 'Introduce la descripción', 'Escribe una descripción'],
  ['es', 'projects.owner', null, 'Propietario', 'Admin principal'],
  ['es', 'projects.loadingInvite', null, 'Cargando invitación...', 'Cargando invitación…'],
  ['es', 'profile.timezoneNotFound', null, 'No se encontró nada', 'Sin resultados'],
  ['es', 'profile.reportBugPlaceholder', null, 'Describe el problema...', 'Describe el problema…'],
  ['es', 'profile.firstNamePlaceholder', null, 'Introduce tu nombre', 'Escribe tu nombre'],
  ['es', 'profile.lastNamePlaceholder', null, 'Introduce tu apellido', 'Escribe tu apellido'],
  ['es', 'profile.emailPlaceholder', null, 'Introduce el correo', 'Escribe tu correo'],
  ['es', 'profile.pushDeniedMessage', null, 'Permite las notificaciones de Rehearsly en los ajustes del teléfono.', 'Permite las notificaciones de Rehearsly en la configuración del teléfono.'],
  ['es', 'profile.openSettings', null, 'Abrir ajustes', 'Abrir configuración'],
  ['es', 'profile.changeEmailSubtitle', ['Anna', 'Hamlet', 'Planner'], 'Enviaremos un código a Anna y otro a la dirección nueva. La dirección cambia cuando introduzcas los dos.', 'Enviaremos un código a Anna y otro a la dirección nueva. La dirección cambiará cuando escribas los dos.'],
  ['es', 'profile.currentAddressCode', ['Anna', 'Hamlet', 'Planner'], 'Código del correo a Anna', 'Código enviado a Anna'],
  ['es', 'profile.newAddressCode', ['Anna', 'Hamlet', 'Planner'], 'Código del correo a Anna', 'Código enviado a Anna'],
  ['es', 'profile.resendCodes', null, 'Enviar los códigos otra vez', 'Reenviar códigos'],
  ['es', 'availability.nothingMarked', null, 'Marca las horas en que no puedes. Hasta entonces, para los demás estás libre.', 'Marca las horas en que no puedes. Mientras no marques nada, los demás te verán libre.'],
  ['es', 'availability.couldNotLoad', null, 'Sin conexión. Se muestra lo último que se cargó — tus marcas están a salvo.', 'Sin conexión. Se muestra lo último que se cargó; tus marcas están a salvo.'],
  ['es', 'availability.lastLoadedShown', null, 'Se muestra lo último que se cargó — tus marcas están a salvo.', 'Se muestra lo último que se cargó; tus marcas están a salvo.'],
  ['es', 'availability.importedNote', null, 'Los demás ven estas horas al buscar un hueco. Para liberarlas, elimina el evento en el calendario del teléfono.', 'Los demás ven estas horas cuando buscan un horario. Para liberarlas, elimina el evento en el calendario del teléfono.'],
  ['es', 'availability.deleteData', null, 'Eliminar datos de esta fecha', 'Eliminar las marcas de este día'],
  ['es', 'availability.deleteDataConfirm', null, '¿Eliminar datos?', '¿Eliminar las marcas?'],
  ['es', 'availability.deleteDataMessage', null, '¿Seguro que quieres eliminar los datos de disponibilidad de esta fecha pasada?', 'Se eliminarán tus marcas de este día, que ya pasó.'],
  ['es', 'availability.pastDateWarning', null, 'Esta es una fecha pasada. Puedes eliminar los datos, pero no editarlos.', 'Este día ya pasó. Puedes eliminar sus marcas, pero no cambiarlas.'],
  ['es', 'availability.slotsOverlap', null, 'Las franjas no deben solaparse', 'Las franjas no pueden superponerse'],
  ['es', 'smartPlanner.analyzing', null, 'Analizando disponibilidad...', 'Viendo quién está libre…'],
  ['es', 'smartPlanner.noSlotsMessage', null, 'Aquí aparecen las horas en que todos pueden. Para eso, cada uno tiene que marcar su tiempo — o prueba otro período.', 'Aquí aparecen las horas en que todos pueden. Para eso, cada uno tiene que marcar sus horas ocupadas. También puedes probar con otro período.'],
  ['es', 'smartPlanner.unknownAvailability', ['Anna', 'Hamlet', 'Planner'], 'Sin disponibilidad registrada: Anna. Se cuentan como libres.', 'Sin datos de disponibilidad: Anna. Quien no marca nada cuenta como libre.'],
  ['es', 'smartPlanner.allMembers', null, 'Todos los miembros', 'Todos los participantes'],
  ['es', 'smartPlanner.busyPrefix', [2], 'Ocupados', 'No disponibles'], ['es', 'smartPlanner.busyPrefix', [1], 'Ocupados', 'No disponible'], // by the number since T-258
  ['es', 'calendarSync.explanation', null, 'Los ensayos pasan al calendario del teléfono, y de él solo llegan las horas que tienes ocupadas, nunca qué son los eventos.', 'Los ensayos pasan al calendario del teléfono; de él solo llegan las horas que tienes ocupadas, nunca el nombre de los eventos.'],
  ['es', 'calendarSync.checkingPermissions', null, 'Comprobando permisos...', 'Comprobando permisos…'],
  ['es', 'calendarSync.removeAllPartial', [1, 1], 'Eliminados: 1. No se pudieron eliminar: 1 — esos eventos siguen en el calendario.', 'Eliminados: 1. Un evento no se pudo eliminar y sigue en el calendario.'],
  ['es', 'calendarSync.removeAllPartial', [2, 3], 'Eliminados: 2. No se pudieron eliminar: 3 — esos eventos siguen en el calendario.', 'Eliminados: 2. No se pudieron eliminar 3 eventos, que siguen en el calendario.'],
  ['es', 'notifications.markAllRead', null, 'Marcar todas', 'Marcar como leídas'],
  ['es', 'notifications.clearAll', null, 'Vaciar', 'Borrar todo'],
  ['es', 'notifications.clearAllConfirm', null, '¿Vaciar las notificaciones?', '¿Borrar todas las notificaciones?'],
  ['es', 'onboarding.welcome.feature1', null, 'Cada uno marca cuándo está ocupado', 'Cada uno marca sus horas ocupadas'],
  ['es', 'onboarding.whatWhere.projectWhere', ['Anna', 'Hamlet', 'Planner'], '“+” → “Anna”. Con un código: “Hamlet” → “Planner”', '«+» → «Anna». Con una invitación: «Hamlet» → «Planner»'],
  ['es', 'onboarding.whatWhere.rehearsalWhere', ['Anna', 'Hamlet', 'Planner'], '“+” → “Anna”, en los proyectos que administras', '«+» → «Anna», en los proyectos que administras'],
  ['es', 'onboarding.whatWhere.availabilityWhere', ['Anna', 'Hamlet', 'Planner'], '“+” → “Anna”', '«+» → «Anna»'],
  ['es', 'onboarding.whatWhere.plannerWhere', ['Anna', 'Hamlet', 'Planner'], '“Anna”, debajo del calendario', '«Anna», debajo del calendario'],
  // de
  ['de', 'common.loading', null, 'Wird geladen...', 'Wird geladen …'],
  ['de', 'common.invalidDateRange', null, 'Wähle gültige Start- und Enddaten.', 'Wähle ein gültiges Start- und Enddatum.'],
  ['de', 'common.dateRangeTooLong', [1, 1], 'Wähle einen Zeitraum von höchstens 1 Tagen, einschließlich des ersten und letzten Tages.', 'Wähle einen Zeitraum von höchstens 1 Tag, einschließlich des ersten und letzten Tages.'],
  ['de', 'actionSheet.title', null, 'Neue Aktion', 'Was möchtest du tun?'],
  ['de', 'auth.registerSubtitle', null, 'Tritt Rehearsly bei', 'Willkommen bei Rehearsly'],
  ['de', 'auth.orContinueWith', null, 'oder fortfahren mit', 'oder weiter mit'],
  ['de', 'auth.deliveryUnknown', null, 'Die E-Mail kann etwas dauern. Ist sie nach ein paar Minuten nicht da, fordere den Code erneut an.', 'Es kann etwas dauern, bis die E-Mail ankommt. Ist sie nach ein paar Minuten nicht da, fordere den Code erneut an.'],
  ['de', 'auth.nameInvalid', null, 'Ein Vorname ist nötig; Vor- und Nachname haben höchstens 100 Zeichen.', 'Der Vorname ist erforderlich; Vor- und Nachname dürfen höchstens 100 Zeichen lang sein.'],
  ['de', 'calendar.loading', null, 'Proben werden geladen...', 'Proben werden geladen …'],
  ['de', 'calendar.smartPlannerSubtitle', null, 'Finde die beste Probezeit', 'Finde die beste Zeit für eine Probe'],
  ['de', 'rehearsals.deleteTitle', ['Anna', 'Hamlet', 'Planner'], '„Anna“ löschen, Hamlet?', '„Anna“ (Hamlet) löschen?'],
  ['de', 'rehearsals.deleteNotifies', [1, 1], 'Teilnehmer (1) werden benachrichtigt', '1 Teilnehmer wird benachrichtigt'],
  ['de', 'rehearsals.deleteNotifies', [2, 3], 'Teilnehmer (2) werden benachrichtigt', '2 Teilnehmer werden benachrichtigt'],
  ['de', 'rehearsals.endsNextDay', null, 'am nächsten Tag', 'am Folgetag'],
  ['de', 'rehearsals.notOnRoster', null, 'Du bist nicht in der Besetzung', 'Du bist nicht eingeteilt'],
  ['de', 'rehearsals.noAdminProjects', null, 'Keine Projekte, die du verwaltest', 'Keine Projekte, in denen du Admin bist'],
  ['de', 'rehearsals.loadingMembers', null, 'Mitglieder werden geladen...', 'Mitglieder werden geladen …'],
  ['de', 'rehearsals.busyAt', ['Anna', 'Hamlet', 'Planner'], 'Anna: beschäftigt Hamlet', 'Beschäftigt: Anna (Hamlet)'],
  ['de', 'rehearsals.andMore', [1, 1], 'und 1 weitere', 'und 1 weiterer'], // T-258's, final; compared exactly: it holds "und 1 weitere"
  ['de', 'rehearsals.notFound', null, 'Diese Probe ist nicht verfügbar. Vielleicht wurde sie gelöscht, oder du wurdest aus der Besetzung genommen.', 'Diese Probe ist nicht verfügbar. Vielleicht wurde sie gelöscht oder du bist nicht mehr dafür eingeteilt.'],
  ['de', 'rehearsals.noAvailableTime', null, 'Keine verfügbare Zeit für alle ausgewählten Teilnehmer', 'Keine Zeit, in der alle ausgewählten Teilnehmer frei sind'],
  ['de', 'projects.noProjects', null, 'Hier stehen deine Projekte', 'Hier erscheinen deine Projekte'],
  ['de', 'projects.createToUsePlanner', null, 'Hier siehst du, wer wann frei ist. Dafür braucht es ein Projekt mit Leuten.', 'Hier siehst du, wer wann frei ist. Dafür brauchst du ein Projekt mit Mitgliedern.'],
  ['de', 'projects.shareInviteTitle', ['Anna', 'Hamlet', 'Planner'], 'Einladung zum Projekt Anna', 'Einladung zum Projekt „Anna“'],
  ['de', 'projects.makeAdmin', null, 'Administratorrechte geben', 'Adminrechte geben'],
  ['de', 'projects.removeAdmin', null, 'Administratorrechte entfernen', 'Adminrechte entziehen'],
  ['de', 'projects.makeAdminConfirm', null, 'Administratorrechte geben?', 'Adminrechte geben?'],
  ['de', 'projects.makeAdminMessage', ['Anna', 'Hamlet', 'Planner'], 'Möchtest du Anna wirklich Administratorrechte für das Projekt geben?', 'Möchtest du Anna wirklich Adminrechte für das Projekt geben?'],
  ['de', 'projects.removeAdminConfirm', null, 'Administratorrechte entfernen?', 'Adminrechte entziehen?'],
  ['de', 'projects.removeAdminMessage', ['Anna', 'Hamlet', 'Planner'], 'Möchtest du Anna wirklich die Administratorrechte entziehen?', 'Möchtest du Anna wirklich die Adminrechte entziehen?'],
  ['de', 'projects.loadingInvite', null, 'Einladung wird geladen...', 'Einladung wird geladen …'],
  ['de', 'profile.notifications', null, 'Benachrichtigungen', 'Mitteilungen'],
  ['de', 'profile.reportBugPlaceholder', null, 'Problem beschreiben...', 'Problem beschreiben …'],
  ['de', 'profile.deleteAccountWarning', null, 'Diese Aktion ist unumkehrbar. Alle deine Daten werden dauerhaft gelöscht – samt den Projekten, die dir gehören, und all ihren Proben. Alle anderen darin verlieren sie ebenfalls.', 'Diese Aktion ist unumkehrbar. Alle deine Daten werden dauerhaft gelöscht – samt den Projekten, die dir gehören, und all ihren Proben. Auch alle anderen Mitglieder verlieren den Zugriff darauf.'],
  ['de', 'profile.notificationError', null, 'Benachrichtigungseinstellungen konnten nicht aktualisiert werden', 'Mitteilungseinstellungen konnten nicht geändert werden'],
  ['de', 'profile.pushDeniedTitle', null, 'Benachrichtigungen sind nicht erlaubt', 'Mitteilungen sind nicht erlaubt'],
  ['de', 'profile.pushDeniedMessage', null, 'Erlaube Benachrichtigungen für Rehearsly in den Einstellungen des Telefons.', 'Erlaube Mitteilungen für Rehearsly in den Geräteeinstellungen.'],
  ['de', 'profile.pushUnsupported', null, 'Dieses Gerät kann keine Push-Benachrichtigungen empfangen.', 'Dieses Gerät kann keine Push-Mitteilungen empfangen.'],
  ['de', 'profile.pushFailed', null, 'Benachrichtigungen konnten auf diesem Gerät nicht aktiviert werden. Prüfe die Verbindung und versuche es erneut.', 'Mitteilungen konnten auf diesem Gerät nicht aktiviert werden. Prüfe die Verbindung und versuche es erneut.'],
  ['de', 'profile.pushNotAllowedHere', null, 'Benachrichtigungen sind auf diesem Telefon nicht erlaubt. Tippe, um sie zu erlauben.', 'Mitteilungen sind auf diesem Gerät nicht erlaubt. Tippe, um sie zu erlauben.'],
  ['de', 'profile.pushNotRegisteredHere', null, 'Dieses Telefon ist noch nicht für Benachrichtigungen eingerichtet. Tippe, um es erneut zu versuchen.', 'Dieses Gerät ist noch nicht für Mitteilungen eingerichtet. Tippe, um es erneut zu versuchen.'],
  ['de', 'profile.deliveryUnknownTo', ['Anna', 'Hamlet', 'Planner'], 'Die E-Mail an Anna kann etwas dauern. Ist sie nach ein paar Minuten nicht da, fordere die Codes erneut an.', 'Es kann etwas dauern, bis die E-Mail an Anna ankommt. Ist sie nach ein paar Minuten nicht da, fordere die Codes erneut an.'],
  ['de', 'profile.emailChanged', ['Anna', 'Hamlet', 'Planner'], 'Du meldest dich jetzt mit Anna an. Die bisherige Adresse hat eine Nachricht bekommen.', 'Du meldest dich jetzt mit Anna an. An deine bisherige Adresse haben wir einen Hinweis geschickt.'],
  ['de', 'availability.busyTime', null, 'Beschäftigte Zeit', 'Belegte Zeit'],
  ['de', 'availability.nextDay', null, 'Folgetag', 'am Folgetag'],
  ['de', 'availability.importedNote', null, 'Diese Zeiten sehen die anderen bei der Terminsuche. Um sie freizugeben, lösche den Termin im Kalender deines Telefons.', 'Diese Zeiten sehen die anderen bei der Terminsuche. Um sie freizugeben, lösche den Termin in deiner Kalender-App.'],
  ['de', 'availability.deleteData', null, 'Daten für dieses Datum löschen', 'Einträge für diesen Tag löschen'],
  ['de', 'availability.deleteDataConfirm', null, 'Daten löschen?', 'Einträge löschen?'],
  ['de', 'availability.deleteDataMessage', null, 'Möchtest du die Verfügbarkeitsdaten für dieses vergangene Datum wirklich löschen?', 'Deine Einträge für diesen vergangenen Tag werden gelöscht.'],
  ['de', 'availability.pastDateWarning', null, 'Dies ist ein vergangenes Datum. Du kannst Daten löschen, aber nicht bearbeiten.', 'Dieser Tag ist vorbei. Du kannst die Einträge löschen, aber nicht mehr ändern.'],
  ['de', 'availability.selectedDates', [1, 1], 'Ausgewählte Daten: 1', 'Ausgewählte Tage: 1'],
  ['de', 'smartPlanner.analyzing', null, 'Verfügbarkeit wird analysiert...', 'Verfügbarkeit wird analysiert …'],
  ['de', 'smartPlanner.noSlotsMessage', null, 'Hier erscheinen die Stunden, die allen passen. Dafür müssen alle ihre Zeiten eintragen – oder versuch einen anderen Zeitraum.', 'Hier erscheinen die Stunden, die allen passen. Dafür müssen alle eintragen, wann sie beschäftigt sind – oder wähle einen anderen Zeitraum.'],
  ['de', 'smartPlanner.dates', null, 'Daten', 'Tage'],
  ['de', 'smartPlanner.unknownAvailability', ['Anna', 'Hamlet', 'Planner'], 'Keine Verfügbarkeit hinterlegt: Anna. Sie zählen als frei.', 'Keine Verfügbarkeit hinterlegt: Anna. Wer nichts eingetragen hat, zählt als frei.'],
  ['de', 'smartPlanner.addRehearsalAt', ['Anna', 'Hamlet', 'Planner'], 'Probe hinzufügen Anna', 'Probe für Anna hinzufügen'],
  ['de', 'smartPlanner.allMembers', null, 'Alle Mitglieder', 'Alle Teilnehmer'],
  ['de', 'calendarSync.explanation', null, 'Proben kommen in den Kalender deines Telefons, und von dort nur die Stunden, in denen du beschäftigt bist – nie, was die Termine sind.', 'Proben landen in deiner Kalender-App. Von dort übernimmt Rehearsly nur, wann du beschäftigt bist – nie, wie deine Termine heißen.'],
  ['de', 'calendarSync.checkingPermissions', null, 'Berechtigungen werden geprüft...', 'Berechtigungen werden geprüft …'],
  ['de', 'calendarSync.syncedAgo', ['Anna', 'Hamlet', 'Planner'], 'Synchronisiert Anna', 'Synchronisiert: Anna'],
  ['de', 'calendarSync.daysAgo', [1, 1], 'vor 1 Tg.', 'gestern'],
  ['de', 'calendarSync.daysAgo', [2, 3], 'vor 2 Tg.', 'vor 2 Tagen'],
  ['de', 'notifications.markAllRead', null, 'Alle als gelesen', 'Alle gelesen'],
  ['de', 'notifications.clearAll', null, 'Leeren', 'Alle löschen'],
  ['de', 'notifications.clearAllConfirm', null, 'Mitteilungen leeren?', 'Alle Mitteilungen löschen?'],
  ['de', 'notifications.clearAllConfirmBody', null, 'Die Liste wird leer sein. Das lässt sich nicht rückgängig machen.', 'Die Liste wird geleert. Das lässt sich nicht rückgängig machen.'],
  ['de', 'notifications.daysAgo', [2, 3], 'vor 2 Tg.', 'vor 2 Tagen'],
  ['de', 'onboarding.skipMessage', null, 'Du kannst den Wochenbeginn und die Kalendersynchronisation jederzeit unter Profil → Einstellungen einrichten', 'Du kannst den Wochenbeginn und die Kalendersynchronisation jederzeit unter Profil → Einstellungen ändern.'],
  ['de', 'onboarding.welcome.feature3', null, 'Die Probe landet in jedem Kalender', 'Die Probe landet bei allen im Kalender'],
  ['de', 'onboarding.notifications.exampleAdded', null, 'Du wurdest zu einer Probe hinzugefügt', 'Du wurdest für eine Probe eingeteilt'],
  ['de', 'onboarding.calendarSync.title', null, 'Deine Zeiten', 'Deine Verfügbarkeit'],
  ['de', 'onboarding.calendarSync.description', null, 'Das Ensemble sieht nur die Stunden, in denen du beschäftigt bist, nie womit. Wähle einen Kalender deines Telefons, und diese Stunden kommen von selbst herüber.', 'Die anderen im Projekt sehen nur, wann du beschäftigt bist – nie, womit. Wähle einen deiner Kalender aus, dann kommen diese Zeiten von selbst herüber.'],
  ['de', 'onboarding.calendarSync.google', null, 'Google Calendar', 'Google Kalender'],
  ['de', 'onboarding.calendarSync.apple', null, 'Apple Calendar', 'Apple Kalender'],
  // The ellipsis after a no-break space, as in the rest (de 1, 34).
  ['de', 'onboarding.calendarSync.settingUp', null, 'Kalendersynchronisation wird eingerichtet …', 'Kalendersynchronisation wird eingerichtet …'],
  ['de', 'onboarding.whatWhere.title', null, 'Was ist wo', 'Wo ist was?'],
  ['de', 'onboarding.whatWhere.availability', null, 'Zeiten', 'Verfügbarkeit'],
];

// [file, key, before (3b16cd5), after] — iOS's own permission prompts.
const IOS_TEXTS: Array<[string, string, string, string]> = [
  ['locales/ru.json', 'NSRemindersUsageDescription', 'Rehearsly работает только с календарём и не запрашивает доступ к напоминаниям.', 'Rehearsly не использует ваши напоминания.'],
  ['locales/ru.json', 'NSRemindersFullAccessUsageDescription', 'Rehearsly работает только с календарём и не запрашивает доступ к напоминаниям.', 'Rehearsly не использует ваши напоминания.'],
  ['locales/en.json', 'NSCalendarsUsageDescription', 'Rehearsly adds your rehearsals to your calendar. From the calendars you pick it takes only the hours you are busy, never what your events are called.', 'Rehearsly adds your rehearsals to your calendar. From the calendars you pick, it reads only the hours you are busy, never what your events are called.'],
  ['locales/en.json', 'NSCalendarsFullAccessUsageDescription', 'Rehearsly adds your rehearsals to your calendar. From the calendars you pick it takes only the hours you are busy, never what your events are called.', 'Rehearsly adds your rehearsals to your calendar. From the calendars you pick, it reads only the hours you are busy, never what your events are called.'],
  ['locales/en.json', 'NSRemindersUsageDescription', 'Rehearsly works only with your calendar and never asks for access to your reminders.', 'Rehearsly does not use your reminders.'],
  ['locales/en.json', 'NSRemindersFullAccessUsageDescription', 'Rehearsly works only with your calendar and never asks for access to your reminders.', 'Rehearsly does not use your reminders.'],
  ['locales/es.json', 'NSCalendarsUsageDescription', 'Rehearsly anota los ensayos en el calendario. De los calendarios elegidos solo toma las horas ocupadas, nunca el nombre de los eventos.', 'Rehearsly anota los ensayos en el calendario. De los calendarios que elijas solo toma las horas ocupadas, nunca el nombre de los eventos.'],
  ['locales/es.json', 'NSCalendarsFullAccessUsageDescription', 'Rehearsly anota los ensayos en el calendario. De los calendarios elegidos solo toma las horas ocupadas, nunca el nombre de los eventos.', 'Rehearsly anota los ensayos en el calendario. De los calendarios que elijas solo toma las horas ocupadas, nunca el nombre de los eventos.'],
  ['locales/es.json', 'NSRemindersUsageDescription', 'Rehearsly solo trabaja con el calendario y nunca pide acceso a tus recordatorios.', 'Rehearsly no usa tus recordatorios.'],
  ['locales/es.json', 'NSRemindersFullAccessUsageDescription', 'Rehearsly solo trabaja con el calendario y nunca pide acceso a tus recordatorios.', 'Rehearsly no usa tus recordatorios.'],
  ['locales/de.json', 'NSRemindersUsageDescription', 'Rehearsly arbeitet nur mit deinem Kalender und fragt nie nach Zugriff auf deine Erinnerungen.', 'Rehearsly verwendet deine Erinnerungen nicht.'],
  ['locales/de.json', 'NSRemindersFullAccessUsageDescription', 'Rehearsly arbeitet nur mit deinem Kalender und fragt nie nach Zugriff auf deine Erinnerungen.', 'Rehearsly verwendet deine Erinnerungen nicht.'],
  ['app.json', 'NSCalendarsUsageDescription', 'Rehearsly adds your rehearsals to your calendar. From the calendars you pick it takes only the hours you are busy, never what your events are called.', 'Rehearsly adds your rehearsals to your calendar. From the calendars you pick, it reads only the hours you are busy, never what your events are called.'],
  ['app.json', 'NSCalendarsFullAccessUsageDescription', 'Rehearsly adds your rehearsals to your calendar. From the calendars you pick it takes only the hours you are busy, never what your events are called.', 'Rehearsly adds your rehearsals to your calendar. From the calendars you pick, it reads only the hours you are busy, never what your events are called.'],
  ['app.json', 'NSRemindersUsageDescription', 'Rehearsly works only with your calendar and never asks for access to your reminders.', 'Rehearsly does not use your reminders.'],
  ['app.json', 'NSRemindersFullAccessUsageDescription', 'Rehearsly works only with your calendar and never asks for access to your reminders.', 'Rehearsly does not use your reminders.'],
];

const at = (lang: Lang, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], translations[lang]);

const said = (lang: Lang, key: string, args: Args): unknown => {
  const value = at(lang, key);
  return typeof value === 'function' ? (value as (...a: unknown[]) => unknown)(...(args ?? [])) : value;
};

/**
 * Where an old word stays on purpose, in another key with another meaning:
 * Spanish "Listo" is the title of a success alert ("Done"); the editor changed
 * only the sheets' button, common.done, to "OK" (es 35).
 */
const KEPT_ELSEWHERE: Record<Lang, Record<string, string[]>> = {
  ru: {},
  en: {},
  es: { Listo: ['common.success', 'rehearsals.success'] },
  de: {},
};

/** Every string of a language, and every function's at the row's arguments, by key. */
const everyString = (node: unknown, args: Args, key: string, out: Array<[string, string]>): Array<[string, string]> => {
  if (typeof node === 'string') out.push([key, node]);
  else if (typeof node === 'function') {
    try {
      const value = (node as (...a: unknown[]) => unknown)(...(args ?? []));
      if (typeof value === 'string') out.push([key, value]);
    } catch {
      // A function that cannot take these arguments says nothing with them.
    }
  } else if (node && typeof node === 'object' && !Array.isArray(node)) {
    for (const [part, value] of Object.entries(node)) everyString(value, args, key ? `${key}.${part}` : part, out);
  }
  return out;
};

const named = (key: string, args: Args) => (args ? `${key}(${args.map((a) => JSON.stringify(a)).join(', ')})` : key);

describe('T-256: every edit of the native speakers is in, and the old wording is gone', () => {
  it.each(['ru', 'en', 'es', 'de'] as const)('%s', (lang) => {
    const wrong: string[] = [];
    for (const [, key, args, before, after] of EDITS.filter(([l]) => l === lang)) {
      const now = said(lang, key, args);
      if (now !== after) wrong.push(`${named(key, args)} says ${JSON.stringify(now)}, not ${JSON.stringify(after)}`);
      const kept = KEPT_ELSEWHERE[lang][before] ?? [];
      const still = everyString(translations[lang], args, '', [])
        .filter(([where, value]) => value === before && !kept.includes(where))
        .map(([where]) => where);
      if (still.length > 0) wrong.push(`${JSON.stringify(before)} is still said in ${lang}: ${still.join(', ')}`);
    }
    expect(wrong).toEqual([]);
  });

  it('iOS permission prompts, in every language and in app.json', () => {
    const root = path.resolve(__dirname, '../../..');
    const read = (file: string): Record<string, string> => {
      const json = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
      return file === 'app.json' ? json.expo.ios.infoPlist : json.ios;
    };
    const wrong: string[] = [];
    for (const [file, key, before, after] of IOS_TEXTS) {
      const texts = read(file);
      if (texts[key] !== after) wrong.push(`${file} ${key} says ${JSON.stringify(texts[key])}`);
      if (Object.values(texts).includes(before)) wrong.push(`${file} still says ${JSON.stringify(before)}`);
    }
    expect(wrong).toEqual([]);
  });
});
