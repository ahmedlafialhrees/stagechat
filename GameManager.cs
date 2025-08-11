using UnityEngine;
using UnityEngine.UI;

public class GameManager : MonoBehaviour
{
    public Health playerHealth;
    public Slider hpBar;
    public GameObject losePanel;

    void Start()
    {
        if (playerHealth != null)
        {
            playerHealth.onHealthChanged.AddListener(UpdateHP);
            playerHealth.onDied.AddListener(OnPlayerDied);
            UpdateHP(playerHealth != null ? playerHealth.GetType().GetField("_hp",
                System.Reflection.BindingFlags.NonPublic|System.Reflection.BindingFlags.Instance) != null ? 0 : 0, 0);
        }
        if (losePanel) losePanel.SetActive(false);
    }

    public void UpdateHP(int current, int max)
    {
        if (!hpBar) return;
        hpBar.maxValue = max;
        hpBar.value = current;
    }

    void OnPlayerDied()
    {
        if (losePanel) losePanel.SetActive(true);
        Time.timeScale = 0f;
    }
}
