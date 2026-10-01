const names = { orbit: 'Орбита', split: 'Связка', facet: 'Грань', arc: 'Арка', frame: 'Контур' };
const choices = [...document.querySelectorAll('.choose-button')];
const status = document.querySelector('#selected-style');
function setChoice(choice) {
  if (!names[choice]) return;
  localStorage.setItem('delmarButtonStyle', choice);
  choices.forEach((button) => {
    const selected = button.dataset.choice === choice;
    button.setAttribute('aria-pressed', String(selected));
    button.textContent = selected ? 'Выбрано' : 'Выбрать этот вариант';
    button.closest('.lab-card').classList.toggle('is-selected', selected);
  });
  status.textContent = 'Выбран вариант «' + names[choice] + '»';
}
choices.forEach((button) => button.addEventListener('click', () => setChoice(button.dataset.choice)));
setChoice(localStorage.getItem('delmarButtonStyle') || 'orbit');
