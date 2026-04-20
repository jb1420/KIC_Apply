const modal = document.getElementById('modal');

function openModal() {
  modal.classList.add('open');
  document.body.classList.add('modal-open');
  modal.scrollTop = 0;
}

function closeModal() {
  modal.classList.remove('open');
  document.body.classList.remove('modal-open');
}

modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
});
